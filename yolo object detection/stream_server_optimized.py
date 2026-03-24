"""
OPTIMIZED YOLO Camera Stream Server - Producer-Consumer Architecture
Designed for Raspberry Pi 5 with Camera Module 3 NoIR

Architecture:
- Thread 1 (Producer): Captures 416x416 frames from hardware ISP at 30 FPS
- Thread 2 (Consumer A): Reads buffer and streams MJPEG to network
- Thread 3 (Consumer B): Reads buffer and runs NCNN AI inference

Performance Target: 25-30 FPS with real-time object detection
"""

import cv2
import io
import logging
import signal
import sys
import time
import threading
import numpy as np
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from picamera2 import Picamera2
from datetime import datetime
from typing import Optional, Dict, List
import json
import urllib.request
import requests
import serial
import glob

# Always import YOLO for fallback
from ultralytics import YOLO

# Import NCNN (fallback to PyTorch if not available)
try:
    import ncnn
    NCNN_AVAILABLE = True
    print("✅ NCNN module loaded - will attempt optimized inference")
except ImportError:
    NCNN_AVAILABLE = False
    print("⚠️ NCNN not available - using PyTorch with multithreading")

# Flask app setup
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================

MODEL_PATH = "models/yolov8s-custom_ncnn_model"   # Restored: Small custom model for Snake and Rat detection
MODEL_PATH_PT = "models/yolov8s-custom.pt"        # Restored: Fallback PyTorch model
CAPTURE_SIZE = (640, 640)                 # Higher detail helps detect small targets like Rat/Snake
TARGET_FPS = 30                           # Camera capture target
JPEG_QUALITY = 70                         # Stream compression quality
CONFIDENCE_THRESHOLD = 0.15               # Low base confidence for small-object recall
IOU_THRESHOLD = 0.45                      # Non-max suppression
INFERENCE_IMAGE_SIZE = 640                # Match training/default YOLO scale for better small-object detection

# Per-class confidence thresholds after model inference.
# Rat/Snake are typically smaller in-frame and need a lower cutoff.
CLASS_CONFIDENCE_THRESHOLDS = {
    "Person": 0.30,
    "Cat": 0.30,
    "Dog": 0.30,
    "Rat": 0.20,
    "Snake": 0.20,
}
TARGET_CLASSES = set(CLASS_CONFIDENCE_THRESHOLDS.keys())

# Configuration for Alerts
ALERT_WEBHOOK_URL = "https://us-central1-internet-of-tsiken-f0ad4.cloudfunctions.net/notifyPredator"
ALERT_COOLDOWN_SECONDS = 60  # 1 minute
last_alert_times = {}

# Configuration for Solenoid Valve (Arduino Uno via Serial)
VALVE_SERIAL_PORT = None  # Auto-detect Arduino
VALVE_BAUD_RATE = 115200
VALVE_PREDATORS = ["Cat", "Dog", "Rat", "Snake"]  # Triggers valve (match custom model classes)
VALVE_DETECTION_DURATION = 10.0  # Predator must be detected for 10 seconds continuously (initial)
ARDUINO_VALVE_DURATION = 10.0    # Arduino keeps valve open for 10 seconds (from valve_controller.ino)
VALVE_REPEAT_DELAY = 15.0        # Wait 15 seconds after valve trigger before allowing repeat (Arduino cycle + buffer)
VALVE_COOLDOWN_SECONDS = 120     # 2 minutes cooldown between activations (when predator disappears and comes back)
valve_last_trigger_time = {}     # Track last trigger per predator type
predator_detection_start = {}    # Track when predator was first detected
predator_valve_triggered = {}    # Track if valve was recently triggered for this predator (for repeat logic)

# ==================== SHARED MEMORY BUFFERS ====================

class ThreadSafeBuffer:
    """Thread-safe buffer for sharing frames between producer and consumers"""
    
    def __init__(self):
        self.frame: Optional[np.ndarray] = None
        self.lock = threading.Lock()
        self.frame_id = 0
        self.last_update = 0
    
    def write(self, frame: np.ndarray):
        """Write frame to buffer (Producer)"""
        with self.lock:
            self.frame = frame.copy()
            self.frame_id += 1
            self.last_update = time.time()
    
    def read(self) -> Optional[np.ndarray]:
        """Read frame from buffer (Consumers)"""
        with self.lock:
            if self.frame is not None:
                return self.frame.copy()
            return None
    
    def get_age(self) -> float:
        """Get age of current frame in seconds"""
        with self.lock:
            if self.last_update > 0:
                return time.time() - self.last_update
            return float('inf')

class ThreadSafeDetections:
    """Thread-safe storage for AI detection results"""
    
    def __init__(self):
        self.detections: Dict = {
            'objects': [],
            'fps': 0,
            'inference_time_ms': 0,
            'timestamp': None,
            'count': 0
        }
        self.lock = threading.Lock()
    
    def update(self, detections: Dict):
        """Update detection results"""
        with self.lock:
            self.detections = detections.copy()
    
    def read(self) -> Dict:
        """Read current detections"""
        with self.lock:
            return self.detections.copy()

# Global buffers
frame_buffer = ThreadSafeBuffer()
detection_buffer = ThreadSafeDetections()

# Global state
camera: Optional[Picamera2] = None
ai_model = None
running = True
threads_started = False
valve_serial: Optional[serial.Serial] = None  # Serial connection to Arduino
predator_last_seen_time = {}   # Track when predator was last seen (for grace period)
DETECTION_GRACE_PERIOD = 5.0   # Seconds to keep tracking if detection flickers (Increased for stability)

# Performance metrics
producer_fps = 0
streaming_fps = 0
inference_fps = 0

# ==================== NCNN INFERENCE ENGINE ====================

class NCNNDetector:
    """NCNN-based YOLO detector for ARM optimization"""
    
    def __init__(self, model_path: str):
        self.net = ncnn.Net()
        self.net.opt.use_vulkan_compute = False  # CPU only on Pi 5
        self.net.opt.num_threads = 4             # Use 4 cores
        
        param_file = f"{model_path}/model.param"
        bin_file = f"{model_path}/model.bin"
        
        logger.info(f"Loading NCNN model from {model_path}")
        
        if self.net.load_param(param_file) != 0:
            raise RuntimeError(f"Failed to load {param_file}")
        if self.net.load_model(bin_file) != 0:
            raise RuntimeError(f"Failed to load {bin_file}")
        
        logger.info("✅ NCNN model loaded successfully")
    
    def detect(self, frame: np.ndarray, conf_threshold: float = 0.5) -> List[Dict]:
        """
        Run NCNN inference on frame
        Returns list of detections: [{'class': str, 'confidence': float, 'bbox': [x1,y1,x2,y2]}]
        """
        h, w = frame.shape[:2]
        
        # Prepare input
        mat_in = ncnn.Mat.from_pixels(frame, ncnn.Mat.PixelType.PIXEL_RGB, w, h)
        
        # Normalize (YOLO expects 0-1 range)
        mean_vals = [0, 0, 0]
        norm_vals = [1.0/255.0, 1.0/255.0, 1.0/255.0]
        mat_in.substract_mean_normalize(mean_vals, norm_vals)
        
        # Create extractor
        ex = self.net.create_extractor()
        ex.input("in0", mat_in)
        
        # Run inference
        mat_out = ncnn.Mat()
        ex.extract("out0", mat_out)
        
        # Parse detections (simplified - needs full YOLO post-processing)
        detections = []
        
        # TODO: Implement full YOLO post-processing for NCNN output
        # For now, this is a placeholder structure
        
        return detections

# ==================== VALVE CONTROL FUNCTIONS ====================

def detect_arduino_port():
    """
    Auto-detect Arduino Uno serial port
    Returns: Serial port path or None
    """
    potential_ports = glob.glob('/dev/ttyUSB*') + glob.glob('/dev/ttyACM*')

    for port in potential_ports:
        try:
            logger.info(f"Trying Arduino on {port}...")
            ser = serial.Serial(port, VALVE_BAUD_RATE, timeout=2)
            time.sleep(3)  # Wait longer for Arduino to reset and send startup messages

            # Read initial startup messages (Arduino sends multiple lines)
            startup_messages = []
            for _ in range(8):  # Read up to 8 lines of startup messages
                if ser.in_waiting > 0:
                    response = ser.readline().decode('utf-8', errors='ignore')
                    startup_messages.append(response.strip())
                time.sleep(0.1)

            # Test STATUS command
            ser.write(b'STATUS\n')
            time.sleep(0.3)  # Wait longer for response

            status_responses = []
            for _ in range(3):  # Read up to 3 lines of status response
                if ser.in_waiting > 0:
                    response = ser.readline().decode('utf-8', errors='ignore')
                    status_responses.append(response.strip())
                time.sleep(0.1)

            # Check all responses for Arduino identification
            all_responses = startup_messages + status_responses
            for response in all_responses:
                if 'VALVE' in response.upper() or 'PREDATOR' in response.upper():
                    logger.info(f"✅ Arduino detected on {port}")
                    logger.info(f"   Startup: {startup_messages}")
                    logger.info(f"   Status: {status_responses}")
                    return ser

            logger.warning(f"Port {port} responded but not Arduino valve controller")
            logger.debug(f"   Responses: {all_responses}")
            ser.close()

        except (OSError, serial.SerialException) as e:
            logger.debug(f"Port {port} failed: {e}")
            continue

    logger.warning("⚠️ Arduino Uno not detected. Valve control disabled.")
    return None

def trigger_valve(predator_type: str):
    """
    Send OPEN_VALVE command to Arduino via serial
    Enhanced with auto-reconnection logic for robustness
    """
    global valve_serial

    # Attempt to reconnect if connection is missing
    if valve_serial is None:
        logger.warning(f"🔄 Arduino connection lost. Attempting to reconnect...")
        valve_serial = detect_arduino_port()
        if valve_serial is None:
            logger.warning(f"🚫 Valve trigger skipped for {predator_type}: Arduino unavailable")
            return False

    try:
        command = "OPEN_VALVE\n"
        valve_serial.write(command.encode('utf-8'))
        valve_serial.flush()

        logger.warning(f"🚨 VALVE TRIGGERED for {predator_type.upper()}!")

        # Read Arduino response with better timeout handling
        time.sleep(0.1)  # Increased wait time for Arduino response
        responses = []

        # Read multiple response lines if available
        for _ in range(3):  # Try to read up to 3 response lines
            if valve_serial.in_waiting > 0:
                try:
                    response = valve_serial.readline().decode('utf-8', errors='ignore').strip()
                    if response:  # Only log non-empty responses
                        responses.append(response)
                        logger.info(f"   Arduino: {response}")
                except:
                    break
            else:
                break
            time.sleep(0.05)

        # Check if Arduino rejected the command
        all_responses = ' '.join(responses).upper()
        if 'REJECTED' in all_responses or 'ALREADY ACTIVE' in all_responses:
            logger.warning(f"⚠️ Arduino rejected valve command (valve busy)")
            return False
        elif 'VALVE OPENED' in all_responses:
            logger.info(f"✅ Arduino confirmed valve opened for {predator_type}")
            return True
        elif responses:
            logger.info(f"✅ Arduino responded positively")
            return True
        else:
            logger.warning(f"⚠️ No response from Arduino (command may have succeeded)")
            return True  # Assume success if no response

    except (serial.SerialException, OSError) as e:
        logger.error(f"❌ Serial connection error during trigger: {e}")
        logger.info("   🔌 Forcing reconnection on next attempt...")
        try:
            valve_serial.close()
        except:
            pass
        valve_serial = None  # Reset to force auto-reconnection next time
        return False
    except Exception as e:
        logger.error(f"❌ Valve trigger failed: {e}")
        return False

def check_predator_detection(predator_type: str) -> bool:
    """
    Check if predator should trigger valve based on detection duration.

    Logic:
    1. Initial detection: Must be present for 10 seconds → trigger valve
    2. Repeat detection: If still present after valve triggered → wait 11 seconds (Arduino cycle) → trigger again
    3. Cooldown: If predator disappears and comes back → 120 second cooldown + 10 second requirement

    Returns True if valve should be triggered
    """
    current_time = time.time()

    # Check if predator type triggers valve
    if predator_type not in VALVE_PREDATORS:
        return False

    # Initialize detection start time if not exists
    if predator_type not in predator_detection_start:
        predator_detection_start[predator_type] = current_time
        # Reset valve triggered flag for new detection
        predator_valve_triggered[predator_type] = False
        logger.info(f"🔍 {predator_type.upper()} detected - tracking started")
        return False

    # Calculate how long predator has been detected
    detection_duration = current_time - predator_detection_start[predator_type]
    last_trigger = valve_last_trigger_time.get(predator_type, 0)
    time_since_last_trigger = current_time - last_trigger

    # Check if this is a repeat detection (valve was recently triggered for this predator)
    if predator_valve_triggered.get(predator_type, False):
        # Valve was triggered, check if enough time passed for repeat trigger
        if time_since_last_trigger >= VALVE_REPEAT_DELAY:
            logger.warning(f"🔄 {predator_type.upper()} still present after {time_since_last_trigger:.1f}s - REPEAT VALVE ACTIVATION!")
            valve_last_trigger_time[predator_type] = current_time
            # Keep valve_triggered flag True for continuous repeat triggers
            return True
        else:
            remaining = VALVE_REPEAT_DELAY - time_since_last_trigger
            logger.info(f"⏳ {predator_type.upper()} repeat trigger in {remaining:.1f}s")
            return False

    # This is initial detection or new detection after cooldown
    # Check if cooldown is active (predator disappeared and came back)
    if time_since_last_trigger < VALVE_COOLDOWN_SECONDS:
        remaining_cooldown = VALVE_COOLDOWN_SECONDS - time_since_last_trigger
        if detection_duration >= VALVE_DETECTION_DURATION:
            logger.debug(f"⏳ {predator_type.upper()} cooldown active ({remaining_cooldown:.0f}s remaining)")
        return False

    # Check if predator has been present for required initial duration
    if detection_duration >= VALVE_DETECTION_DURATION:
        logger.warning(f"⚠️ {predator_type.upper()} present for {detection_duration:.1f}s - INITIAL VALVE ACTIVATION!")
        valve_last_trigger_time[predator_type] = current_time
        predator_valve_triggered[predator_type] = True  # Mark as recently triggered for repeat logic
        # Don't reset detection start - keep tracking for repeat triggers
        return True
    else:
        remaining = VALVE_DETECTION_DURATION - detection_duration
        logger.info(f"⏱️ {predator_type.upper()} tracking: {detection_duration:.1f}s / {VALVE_DETECTION_DURATION}s ({remaining:.1f}s remaining)")
        return False

def reset_predator_tracking(detected_predators: List[str]):
    """
    Reset tracking for predators that are no longer detected
    Implements a grace period to handle flickering detections
    """
    current_time = time.time()
    current_predators = set(detected_predators)
    tracked_predators = list(predator_detection_start.keys())

    # Update last seen time for currently detected predators
    for predator in current_predators:
        predator_last_seen_time[predator] = current_time

    for predator in tracked_predators:
        if predator not in current_predators:
            # Check grace period
            last_seen = predator_last_seen_time.get(predator, 0)
            if current_time - last_seen < DETECTION_GRACE_PERIOD:
                # Still within grace period, don't reset yet
                continue
                
            logger.info(f"✅ {predator.upper()} no longer detected - reset tracking")
            predator_detection_start.pop(predator, None)
            predator_last_seen_time.pop(predator, None)
            # Reset valve triggered flag when predator disappears
            predator_valve_triggered[predator] = False


def normalize_class_name(raw_name: str) -> str:
    """Normalize model class labels to title case used by notifications/valve logic."""
    return str(raw_name).strip().capitalize()


def should_keep_detection(class_name: str, confidence: float) -> bool:
    """Filter detections to configured classes and per-class confidence thresholds."""
    required_conf = CLASS_CONFIDENCE_THRESHOLDS.get(class_name)
    if required_conf is None:
        return False
    return confidence >= required_conf

# ==================== PUSH NOTIFICATION FUNCTIONS ====================

def send_push_notification(predator_type: str, confidence: float = None):
    """
    Send push notification to Firebase Cloud Function for predator detection

    Args:
        predator_type: Type of predator detected (Cat, Dog, Rat, Snake, Person)
        confidence: Detection confidence score (0-1)

    Returns:
        bool: True if notification sent successfully, False otherwise
    """
    try:
        # Prepare notification data
        notification_data = {
            "predator_type": predator_type,
            "confidence": float(confidence) if confidence is not None else None,
            "camera_id": "RaspberryPi_Main_Camera",
            "timestamp": datetime.now().isoformat(),
        }

        logger.info(f"🚨 Sending push notification for: {predator_type}")

        # Send POST request to Firebase Cloud Function
        response = requests.post(
            ALERT_WEBHOOK_URL,
            json=notification_data,
            timeout=10,  # 10 second timeout
            headers={'Content-Type': 'application/json'}
        )

        if response.status_code == 200:
            logger.info(f"✅ PUSH NOTIFICATION SENT FOR: {predator_type} (HTTP {response.status_code})")
            return True
        else:
            logger.error(f"❌ Push notification failed: HTTP {response.status_code} - {response.text}")
            return False

    except requests.exceptions.Timeout:
        logger.error(f"⏰ Push notification timeout for {predator_type}")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"🌐 Push notification network error for {predator_type}: {e}")
        return False
    except Exception as e:
        logger.error(f"💥 Push notification error for {predator_type}: {e}")
        return False

def should_send_notification(predator_type: str) -> bool:
    """
    Check if enough time has passed since last notification for this predator type
    Uses ALERT_COOLDOWN_SECONDS to prevent spam notifications

    Args:
        predator_type: Type of predator detected

    Returns:
        bool: True if notification should be sent, False if in cooldown
    """
    current_time = time.time()

    if predator_type not in last_alert_times:
        # First notification for this predator type
        last_alert_times[predator_type] = current_time
        return True

    time_since_last_alert = current_time - last_alert_times[predator_type]

    if time_since_last_alert >= ALERT_COOLDOWN_SECONDS:
        # Cooldown has passed, allow new notification
        last_alert_times[predator_type] = current_time
        return True
    else:
        # Still in cooldown period
        remaining = ALERT_COOLDOWN_SECONDS - time_since_last_alert
        logger.debug(f"🔕 Notification cooldown for {predator_type} ({remaining:.0f}s remaining)")
        return False

# ==================== THREAD 1: PRODUCER (CAMERA CAPTURE) ====================

def camera_capture_thread():
    """
    Producer Thread: Captures frames from camera at 30 FPS
    Uses hardware ISP to get native 416x416 RGB frames
    """
    global camera, running, producer_fps
    
    logger.info("🎥 [PRODUCER] Camera capture thread started")
    
    try:
        # Initialize camera with hardware ISP configuration
        camera = Picamera2()
        
        # Configure for native 416x416 output from ISP (NO CPU RESIZING)
        config = camera.create_preview_configuration(
            main={"size": CAPTURE_SIZE, "format": "RGB888"},
            controls={"FrameRate": TARGET_FPS}
        )
        
        camera.configure(config)
        camera.start()
        
        logger.info(f"✅ [PRODUCER] Camera started: {CAPTURE_SIZE} @ {TARGET_FPS} FPS")
        
        frame_count = 0
        last_fps_time = time.time()
        
        while running:
            try:
                # Capture frame directly from hardware ISP
                frame = camera.capture_array()
                
                # Write to shared buffer (thread-safe)
                frame_buffer.write(frame)
                
                # Calculate FPS
                frame_count += 1
                if frame_count % 30 == 0:
                    now = time.time()
                    elapsed = now - last_fps_time
                    producer_fps = 30 / elapsed if elapsed > 0 else 0
                    last_fps_time = now
                
                # No sleep - capture as fast as hardware allows
                
            except Exception as e:
                logger.error(f"[PRODUCER] Frame capture error: {e}")
                time.sleep(0.1)
        
        logger.info("🛑 [PRODUCER] Camera capture thread stopped")
        
    except Exception as e:
        logger.error(f"❌ [PRODUCER] Fatal error: {e}")
        running = False
    finally:
        if camera:
            try:
                camera.stop()
                camera.close()
            except:
                pass

# ==================== THREAD 2: CONSUMER A (MJPEG STREAMING) ====================

def mjpeg_streaming_thread():
    """
    Consumer A Thread: Reads buffer and encodes MJPEG stream
    Independent of AI inference - provides smooth video feed
    """
    global running, streaming_fps
    
    logger.info("📡 [STREAMING] MJPEG streaming thread started")
    
    # This thread waits for Flask requests - no active loop needed
    # Streaming happens via generate_frames() generator
    
    logger.info("✅ [STREAMING] Ready to serve video streams")

def generate_frames():
    """Generator function for MJPEG streaming (called by Flask route)"""
    global streaming_fps
    
    frame_count = 0
    last_fps_time = time.time()
    
    while running:
        # Read frame from shared buffer
        frame = frame_buffer.read()
        
        if frame is None:
            time.sleep(0.01)
            continue
        
        # Get latest detections and overlay them
        detections = detection_buffer.read()
        annotated_frame = overlay_detections(frame, detections)
        
        # Add camera status text
        status_text = "Camera Status: Online" if camera is not None else "Camera Status: Offline"
        cv2.putText(
            annotated_frame,
            status_text,
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),  # White color
            2
        )
        
        # Encode to JPEG
        _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        frame_bytes = buffer.tobytes()
        
        # Calculate streaming FPS
        frame_count += 1
        if frame_count % 30 == 0:
            now = time.time()
            elapsed = now - last_fps_time
            streaming_fps = 30 / elapsed if elapsed > 0 else 0
            last_fps_time = now
        
        # Yield frame in MJPEG format
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

# ==================== THREAD 3: CONSUMER B (AI INFERENCE) ====================

def ai_inference_thread():
    """
    Consumer B Thread: Reads buffer and runs NCNN inference
    Asynchronous - doesn't block camera or streaming
    """
    global ai_model, running, inference_fps
    
    logger.info("🤖 [AI INFERENCE] AI processing thread started")
    
    try:
        # Load AI model (NCNN or PyTorch fallback)
        if NCNN_AVAILABLE:
            try:
                ai_model = NCNNDetector(MODEL_PATH)
                logger.info("✅ [AI INFERENCE] Using NCNN optimized inference")
            except Exception as e:
                logger.warning(f"⚠️ [AI INFERENCE] NCNN load failed: {e}, falling back to PyTorch")
                ai_model = YOLO(MODEL_PATH_PT)
        else:
            ai_model = YOLO(MODEL_PATH_PT)
            logger.info("✅ [AI INFERENCE] Using PyTorch inference (slower)")
        
        frame_count = 0
        last_fps_time = time.time()
        
        while running:
            try:
                # Read latest frame from shared buffer
                frame = frame_buffer.read()
                
                if frame is None:
                    time.sleep(0.01)
                    continue
                
                # We removed artificial skipping: Since this thread runs independently, 
                # it will naturally drop unused frames while it's processing the current one.
                # Running it as fast as it can process removes the "laggy bounding box" feel.
                    
                # Run inference
                start_time = time.time()

                if NCNN_AVAILABLE and isinstance(ai_model, NCNNDetector):
                    # NCNN inference
                    detections_list = ai_model.detect(frame, CONFIDENCE_THRESHOLD)
                else:
                    # PyTorch inference
                    results = ai_model(
                        frame,
                        verbose=False,
                        conf=CONFIDENCE_THRESHOLD,
                        iou=IOU_THRESHOLD,
                        imgsz=INFERENCE_IMAGE_SIZE,
                    )

                    # Extract detections
                    detections_list = []
                    detected_predators = []  # Track which predators are currently detected

                    if results[0].boxes is not None and len(results[0].boxes) > 0:
                        for i, box in enumerate(results[0].boxes):
                            # Get class index and name using correct YOLOv8 syntax
                            cls_idx = int(box.cls[0])
                            raw_cls_name = results[0].names[cls_idx]  # Get raw class name from model
                            cls_name = normalize_class_name(raw_cls_name)
                            confidence = float(box.conf[0])

                            # Get bounding box coordinates [x1, y1, x2, y2]
                            bbox = box.xyxy[0].tolist()

                            if not should_keep_detection(cls_name, confidence):
                                continue

                            # Check for predators (for alerts and tracking)
                            if cls_name in TARGET_CLASSES:
                                detected_predators.append(cls_name)

                                # Send push notification with proper cooldown logic
                                if should_send_notification(cls_name):
                                    if cls_name == "Person":
                                        logger.info(f"👤 Person detected - logging only (handled by Cloud Function)")
                                    else:
                                        logger.warning(f"⚠️ PREDATOR DETECTED: {cls_name.upper()}! Sending push notification...")
                                    
                                    # Send notification/log for ALL detected types (cloud function handles filtering)
                                    try:
                                        send_push_notification(cls_name, confidence)
                                    except Exception as e:
                                        logger.error(f"💥 Push notification error for {cls_name}: {e}")
                                else:
                                    logger.debug(f"🔕 {cls_name.upper()} detected but notification in cooldown")

                                # Check valve trigger
                                if check_predator_detection(cls_name):
                                    trigger_valve(cls_name)

                            detections_list.append({
                                'class': cls_name,
                                'confidence': round(confidence * 100, 2),
                                'bbox': [round(x, 2) for x in bbox]
                            })

                    # Reset tracking for predators that are no longer detected
                    reset_predator_tracking(detected_predators)

                inference_time = (time.time() - start_time) * 1000  # ms
                
                # Update detection buffer
                detection_data = {
                    'objects': detections_list,
                    'fps': inference_fps,
                    'inference_time_ms': round(inference_time, 2),
                    'timestamp': datetime.now().isoformat(),
                    'count': len(detections_list)
                }
                detection_buffer.update(detection_data)
                
                # Calculate inference FPS
                frame_count += 1
                if frame_count % 10 == 0:
                    now = time.time()
                    elapsed = now - last_fps_time
                    inference_fps = 10 / elapsed if elapsed > 0 else 0
                    last_fps_time = now

                    # Enhanced autonomous operation status logging every ~90 seconds
                    if frame_count % 300 == 0:  # Every ~90 seconds (300 frames at 3.3 FPS)
                        current_detections = detection_buffer.read()
                        total_objects = current_detections.get('count', 0)
                        logger.warning(f"🤖 [AUTONOMOUS] 24/7 Security Active | AI: {inference_fps:.1f} FPS | Frames: {frame_count} | Objects: {total_objects} | Valve: {'⚡ Ready' if valve_serial else '❌ Offline'}")
                        logger.info(f"   🔄 Independent Operation: Detecting predators without app connection")
                        if valve_serial:
                            # Count active predator tracking
                            active_tracking = len(predator_detection_start)
                            logger.info(f"   ⚡ Valve Status: Armed | Active Tracking: {active_tracking} predators")

                # Throttle inference to ~15-20 FPS (no need to run at 30 FPS)
                time.sleep(0.033)  # ~30ms sleep = ~33 FPS max
                
            except Exception as e:
                logger.error(f"[AI INFERENCE] Processing error: {e}")
                time.sleep(0.1)
        
        logger.info("🛑 [AI INFERENCE] AI processing thread stopped")
        
    except Exception as e:
        logger.error(f"❌ [AI INFERENCE] Fatal error: {e}")
        running = False

# ==================== HELPER FUNCTIONS ====================

def overlay_detections(frame: np.ndarray, detections: Dict) -> np.ndarray:
    """Draw bounding boxes and labels on frame"""
    annotated = frame.copy()
    
    for obj in detections.get('objects', []):
        bbox = obj['bbox']
        label = f"{obj['class']} {obj['confidence']:.0f}%"
        
        # Draw bounding box (white color)
        x1, y1, x2, y2 = map(int, bbox)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (255, 255, 255), 2)
        
        # Draw label background (white)
        (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(annotated, (x1, y1 - 20), (x1 + text_w, y1), (255, 255, 255), -1)
        
        # Draw label text (black text on white background)
        cv2.putText(annotated, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    
    return annotated

def start_all_threads():
    """Start all producer-consumer threads"""
    global threads_started
    
    if threads_started:
        return
    
    logger.info("🚀 Starting producer-consumer threads...")
    
    # Thread 1: Camera capture (Producer)
    producer = threading.Thread(target=camera_capture_thread, daemon=True, name="Producer-Camera")
    producer.start()
    
    # Thread 2: MJPEG streaming (Consumer A) - handled by Flask
    # No separate thread needed - Flask handles this
    
    # Thread 3: AI inference (Consumer B)
    consumer_ai = threading.Thread(target=ai_inference_thread, daemon=True, name="Consumer-AI")
    consumer_ai.start()
    
    threads_started = True
    logger.info("✅ All threads started successfully")

# ==================== FLASK ROUTES ====================

@app.route('/video_feed')
def video_feed():
    """Video streaming route for MJPEG stream"""
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/detections')
def get_detections():
    """API endpoint to get current detection data"""
    return jsonify(detection_buffer.read())

@app.route('/status')
def status():
    """Health check endpoint"""
    return jsonify({
        'status': 'online',
        'camera': camera is not None,
        'model': ai_model is not None,
        'ncnn_available': NCNN_AVAILABLE,
        'ncnn_enabled': NCNN_AVAILABLE and isinstance(ai_model, NCNNDetector),
        'inference_backend': 'ncnn' if (NCNN_AVAILABLE and isinstance(ai_model, NCNNDetector)) else 'pytorch',
        'confidence_threshold': CONFIDENCE_THRESHOLD,
        'producer_fps': round(producer_fps, 1),
        'streaming_fps': round(streaming_fps, 1),
        'inference_fps': round(inference_fps, 1),
        'frame_buffer_age_ms': round(frame_buffer.get_age() * 1000, 1),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/get_public_url')
def get_public_url():
    """Get Cloudflare tunnel public URL"""
    try:
        with open('/tmp/tunnel_url.txt', 'r') as f:
            url = f.read().strip()
            return jsonify({
                'url': url,
                'type': 'cloudflare_tunnel'
            })
    except FileNotFoundError:
        return jsonify({
            'url': None,
            'type': 'local_only',
            'message': 'Tunnel not active - local network only'
        })

@app.route('/snapshot')
def snapshot():
    """Get a single frame snapshot"""
    frame = frame_buffer.read()
    if frame is not None:
        detections = detection_buffer.read()
        annotated = overlay_detections(frame, detections)
        _, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return Response(buffer.tobytes(), mimetype='image/jpeg')
    return jsonify({'error': 'No frame available'}), 404

@app.route('/metrics')
def metrics():
    """Performance metrics endpoint"""
    return jsonify({
        'confidence_threshold': CONFIDENCE_THRESHOLD,
        'producer_fps': round(producer_fps, 2),
        'streaming_fps': round(streaming_fps, 2),
        'inference_fps': round(inference_fps, 2),
        'frame_buffer_age_ms': round(frame_buffer.get_age() * 1000, 2),
        'ncnn_available': NCNN_AVAILABLE,
        'using_ncnn': NCNN_AVAILABLE and isinstance(ai_model, NCNNDetector),
        'inference_backend': 'ncnn' if (NCNN_AVAILABLE and isinstance(ai_model, NCNNDetector)) else 'pytorch',
        'model_path': MODEL_PATH if NCNN_AVAILABLE else MODEL_PATH_PT,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/valve/status')
def valve_status():
    """Check valve system status and predator tracking"""
    return jsonify({
        'valve_connected': valve_serial is not None,
        'valve_port': valve_serial.port if valve_serial else None,
        'valve_predators': VALVE_PREDATORS,
        'detection_duration_required': VALVE_DETECTION_DURATION,
        'repeat_delay': VALVE_REPEAT_DELAY,
        'cooldown_seconds': VALVE_COOLDOWN_SECONDS,
        'active_tracking': {k: round(time.time() - v, 1) for k, v in predator_detection_start.items()},
        'valve_triggered_flags': dict(predator_valve_triggered),
        'last_trigger_times': {k: round(time.time() - v, 1) for k, v in valve_last_trigger_time.items()},
        'timestamp': datetime.now().isoformat()
    })

@app.route('/valve/test')
def valve_test():
    """Manually test valve activation"""
    if valve_serial is None:
        return jsonify({
            'success': False,
            'error': 'Arduino not connected',
            'message': 'No serial connection to Arduino. Check USB connection and restart server.'
        }), 503

    try:
        result = trigger_valve("TEST")
        return jsonify({
            'success': result,
            'message': 'Valve triggered successfully' if result else 'Valve trigger failed or rejected',
            'port': valve_serial.port
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/send_alert')
def send_alert():
    """Send an alert based on detection"""
    predator_type = request.args.get('predator_type')
    confidence = request.args.get('confidence')
    
    if predator_type and confidence:
        try:
            confidence = float(confidence)
            send_alert_async(predator_type, confidence)
        except Exception as e:
            logger.error(f"❌ Invalid alert data: {e}")
    return jsonify({'status': 'alert sent'})

def send_alert_async(predator_type, confidence):
    def fire_request():
        try:
            data = json.dumps({
                "predator_type": predator_type, 
                "confidence": confidence,
                "camera_id": "Main Node"
            }).encode('utf-8')
            req = urllib.request.Request(ALERT_WEBHOOK_URL, data=data, headers={'Content-Type': 'application/json'})
            urllib.request.urlopen(req, timeout=5)
            logger.info(f"🚨 SENT PUSH NOTIFICATION FOR: {predator_type}")
        except Exception as e:
            logger.error(f"❌ Failed to send alert: {e}")
            
    threading.Thread(target=fire_request, daemon=True).start()

# ==================== STARTUP & CLEANUP ====================

def cleanup(signum=None, frame=None):
    """Cleanup resources on shutdown"""
    global running, camera, valve_serial

    logger.info("🛑 Shutting down gracefully...")
    running = False

    time.sleep(1)  # Give threads time to exit

    if camera is not None:
        try:
            camera.stop()
            camera.close()
            logger.info("✅ Camera closed successfully")
        except:
            pass

    if valve_serial is not None:
        try:
            valve_serial.close()
            logger.info("✅ Valve serial connection closed")
        except:
            pass

    sys.exit(0)

def main():
    """Main entry point"""
    global valve_serial

    # Register signal handlers
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    logger.info("=" * 60)
    logger.info("🚀 OPTIMIZED YOLO CAMERA STREAM SERVER")
    logger.info("=" * 60)
    logger.info(f"   Architecture: Producer-Consumer (3 threads)")
    logger.info(f"   Model: {MODEL_PATH if NCNN_AVAILABLE else MODEL_PATH_PT}")
    logger.info(f"   Resolution: {CAPTURE_SIZE}")
    logger.info(f"   Target FPS: {TARGET_FPS}")
    logger.info(f"   NCNN Enabled: {NCNN_AVAILABLE}")
    logger.info("=" * 60)

    # Initialize Arduino valve controller
    logger.info("\n🔌 Detecting Arduino Uno valve controller...")
    valve_serial = detect_arduino_port()
    if valve_serial:
        logger.info(f"   ✅ Valve system ACTIVE on {valve_serial.port}")
        logger.info(f"   🎯 Predators: {', '.join(VALVE_PREDATORS)}")
        logger.info(f"   ⏱️  Initial detection: {VALVE_DETECTION_DURATION}s")
        logger.info(f"   🔄 Repeat trigger: {VALVE_REPEAT_DELAY}s (if predator still present)")
        logger.info(f"   ⏳ Cooldown: {VALVE_COOLDOWN_SECONDS}s (when predator disappears)")
    else:
        logger.warning("   ⚠️  Valve system DISABLED (Arduino not found)")
    logger.info("=" * 60)

    # Start all threads
    start_all_threads()

    # Wait 2 seconds for threads to initialize
    time.sleep(2)

    # Confirm autonomous operation is active
    logger.warning("🤖 ============ AUTONOMOUS OPERATION CONFIRMED ============")
    logger.warning("🔄 AI Detection Thread: ACTIVE - Runs 24/7 independent of React Native app")
    logger.warning(f"⚡ Valve Control: {'ENABLED' if valve_serial else 'DISABLED'} - Triggers automatically on predator detection")
    logger.warning("🌐 Network Status: Web server provides optional monitoring - NOT required for operation")
    logger.warning("📱 App Independence: System detects predators even when mobile app is closed")
    logger.warning("🎯 24/7 Security: Protecting your property around the clock!")
    logger.warning("=" * 60)

    # Start Flask server
    logger.info(f"✅ Server ready at http://0.0.0.0:5000")
    logger.info(f"   Video feed: http://0.0.0.0:5000/video_feed")
    logger.info(f"   Detections: http://0.0.0.0:5000/detections")
    logger.info(f"   Metrics: http://0.0.0.0:5000/metrics")
    
    try:
        app.run(host='0.0.0.0', port=5000, threaded=True, debug=False)
    except KeyboardInterrupt:
        cleanup()

if __name__ == '__main__':
    main()
