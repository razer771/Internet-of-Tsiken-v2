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
from flask import Flask, Response, jsonify
from flask_cors import CORS
from picamera2 import Picamera2
from datetime import datetime
from typing import Optional, Dict, List
import json

# Import NCNN (fallback to ultralytics if not available)
try:
    import ncnn
    NCNN_AVAILABLE = True
    print("✅ NCNN module loaded - using optimized inference")
except ImportError:
    from ultralytics import YOLO
    NCNN_AVAILABLE = False
    print("⚠️ NCNN not available - falling back to PyTorch (slower)")

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

MODEL_PATH = "models/yolov8s-custom_ncnn_model"  # NCNN model directory
MODEL_PATH_PT = "models/yolov8s-custom.pt"       # Fallback PyTorch model
CAPTURE_SIZE = (416, 416)                         # Hardware ISP output size
TARGET_FPS = 30                                   # Camera capture target
JPEG_QUALITY = 70                                 # Stream compression quality
CONFIDENCE_THRESHOLD = 0.5                        # Detection confidence
IOU_THRESHOLD = 0.45                              # Non-max suppression

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
        
        # Add FPS overlay
        cv2.putText(
            annotated_frame,
            f'Capture: {producer_fps:.1f} FPS | Stream: {streaming_fps:.1f} FPS | AI: {inference_fps:.1f} FPS',
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
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
                # Read frame from shared buffer
                frame = frame_buffer.read()
                
                if frame is None:
                    time.sleep(0.01)
                    continue
                
                # Run inference
                start_time = time.time()
                
                if NCNN_AVAILABLE and isinstance(ai_model, NCNNDetector):
                    # NCNN inference
                    detections_list = ai_model.detect(frame, CONFIDENCE_THRESHOLD)
                else:
                    # PyTorch inference
                    results = ai_model(frame, verbose=False, conf=CONFIDENCE_THRESHOLD, iou=IOU_THRESHOLD, imgsz=416)
                    
                    # Extract detections
                    detections_list = []
                    for box in results[0].boxes:
                        cls = int(box.cls[0])
                        conf = float(box.conf[0])
                        name = ai_model.names[cls]
                        bbox = box.xyxy[0].tolist()
                        
                        detections_list.append({
                            'class': name,
                            'confidence': round(conf * 100, 2),
                            'bbox': bbox
                        })
                
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
        
        # Draw bounding box
        x1, y1, x2, y2 = map(int, bbox)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
        
        # Draw label background
        (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(annotated, (x1, y1 - 20), (x1 + text_w, y1), (0, 255, 0), -1)
        
        # Draw label text
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
        'ncnn_enabled': NCNN_AVAILABLE,
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
        'producer_fps': round(producer_fps, 2),
        'streaming_fps': round(streaming_fps, 2),
        'inference_fps': round(inference_fps, 2),
        'frame_buffer_age_ms': round(frame_buffer.get_age() * 1000, 2),
        'using_ncnn': NCNN_AVAILABLE,
        'model_path': MODEL_PATH if NCNN_AVAILABLE else MODEL_PATH_PT,
        'timestamp': datetime.now().isoformat()
    })

# ==================== STARTUP & CLEANUP ====================

def cleanup(signum=None, frame=None):
    """Cleanup resources on shutdown"""
    global running, camera
    
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
    
    sys.exit(0)

def main():
    """Main entry point"""
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
    
    # Start all threads
    start_all_threads()
    
    # Wait 2 seconds for threads to initialize
    time.sleep(2)
    
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
