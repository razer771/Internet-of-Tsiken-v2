"""
YOLO Camera Stream Server for React Native Integration
Streams Raspberry Pi Camera 3 feed with YOLO detections over HTTP
"""

import cv2
import io
import logging
import signal
import sys
from picamera2 import Picamera2
from ultralytics import YOLO
from flask import Flask, Response, jsonify
from flask_cors import CORS
from threading import Thread
import numpy as np
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure logging with timestamp
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Global variables
camera = None
model_coco = None  # 80 COCO classes
model_predators = None  # Snake + Rat
current_frame = None
detection_data = {
    'objects': [],
    'fps': 0,
    'timestamp': None
}

def initialize_camera():
    """Initialize Raspberry Pi Camera 3"""
    global camera
    try:
        camera = Picamera2()
        # Configure for streaming - YOLO optimized resolution (416x416)
        # Smaller resolution = faster processing
        camera.preview_configuration.main.size = (416, 416)
        camera.preview_configuration.main.format = "RGB888"
        camera.preview_configuration.align()
        camera.configure("preview")
        camera.start()
        logger.info("Camera initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize camera: {e}")
        return False

def initialize_model():
    """Initialize DUAL YOLO models - COCO (80 classes) + Predators (snake, rat)"""
    global model_coco, model_predators
    try:
        # Model 1: Base COCO with 80 classes (person, car, dog, cat, bird, etc.)
        logger.info("Loading COCO model (80 classes)...")
        model_coco = YOLO("yolov8n_coco.pt")
        model_coco.to('cpu')
        logger.info(f"✅ COCO model loaded: {len(model_coco.names)} classes")
        
        # Model 2: Custom snake + rat detection
        logger.info("Loading predator model (snake, rat)...")
        model_predators = YOLO("yolov8n_ultimate.pt")
        model_predators.to('cpu')
        logger.info(f"✅ Predator model loaded: {model_predators.names}")
        
        logger.info("🎯 DUAL MODEL ACTIVE - Detecting 80 COCO classes + snakes + rats!")
        return True
    except Exception as e:
        logger.error(f"Failed to load YOLO models: {e}")
        return False

def process_frame():
    """Capture and process frames with DUAL YOLO models"""
    global current_frame, detection_data
    
    frame_count = 0
    last_coco_results = None
    last_predator_results = None
    
    while True:
        try:
            if camera is None or model_coco is None or model_predators is None:
                continue
            
            # Capture frame
            frame = camera.capture_array()
            
            # Skip detection on some frames for speed (detect every 2nd frame)
            frame_count += 1
            if frame_count % 2 == 0 and last_coco_results is not None:
                # Reuse previous results
                coco_results = last_coco_results
                predator_results = last_predator_results
            else:
                # Run BOTH models
                coco_results = model_coco(frame, verbose=False, conf=0.3, iou=0.45, imgsz=416)
                predator_results = model_predators(frame, verbose=False, conf=0.3, iou=0.45, imgsz=416)
                last_coco_results = coco_results
                last_predator_results = predator_results
            
            # Start with annotated frame from COCO model
            annotated_frame = coco_results[0].plot()
            
            # Add predator detections on top
            if len(predator_results[0].boxes) > 0:
                # Draw predator boxes in red for visibility
                for box in predator_results[0].boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    name = model_predators.names[cls]
                    
                    # Red box for predators
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    label = f'{name} {conf:.2f}'
                    cv2.putText(annotated_frame, label, (x1, y1 - 10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
            
            # Calculate FPS
            inference_time = coco_results[0].speed['inference']
            fps = 1000 / inference_time if inference_time > 0 else 0
            
            # Add FPS text to frame
            cv2.putText(
                annotated_frame, 
                f'FPS: {fps:.1f}', 
                (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.7, 
                (0, 255, 0), 
                2
            )
            
            # Extract detection information from BOTH models
            detections = []
            
            # COCO detections
            for box in coco_results[0].boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                name = model_coco.names[cls]
                detections.append({
                    'class': name,
                    'confidence': round(conf * 100, 2),
                    'bbox': box.xyxy[0].tolist()
                })
            
            # Predator detections
            for box in predator_results[0].boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                name = model_predators.names[cls]
                detections.append({
                    'class': name,
                    'confidence': round(conf * 100, 2),
                    'bbox': box.xyxy[0].tolist()
                })
            
            # Log detections to console (only when objects are detected)
            if len(detections) > 0:
                # Create summary of detected objects
                detection_summary = {}
                for det in detections:
                    obj_class = det['class']
                    confidence = det['confidence']
                    if obj_class not in detection_summary:
                        detection_summary[obj_class] = []
                    detection_summary[obj_class].append(confidence)
                
                # Format log message
                log_parts = []
                for obj_class, confidences in detection_summary.items():
                    avg_conf = sum(confidences) / len(confidences)
                    count = len(confidences)
                    log_parts.append(f"{obj_class}({count}x, {avg_conf:.1f}%)")
                
                logger.info(f"🔍 Detected: {', '.join(log_parts)} | FPS: {fps:.1f}")
            
            # Update detection data
            detection_data = {
                'objects': detections,
                'fps': round(fps, 1),
                'timestamp': datetime.now().isoformat(),
                'count': len(detections)
            }
            
            # Encode frame to JPEG with lower quality for faster encoding
            _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            current_frame = buffer.tobytes()
            
        except Exception as e:
            logger.error(f"Error processing frame: {e}")
            continue

def generate_frames():
    """Generator function for video streaming"""
    while True:
        if current_frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + current_frame + b'\r\n')

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
    return jsonify(detection_data)

@app.route('/status')
def status():
    """Health check endpoint"""
    return jsonify({
        'status': 'online',
        'camera': camera is not None,
        'model_coco': model_coco is not None,
        'model_predators': model_predators is not None,
        'dual_model_system': True,
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
    if current_frame is not None:
        return Response(current_frame, mimetype='image/jpeg')
    return jsonify({'error': 'No frame available'}), 404

def cleanup(signum=None, frame=None):
    """Cleanup resources on shutdown"""
    global camera
    logger.info("Shutting down gracefully...")
    if camera is not None:
        try:
            camera.stop()
            camera.close()
            logger.info("Camera closed successfully")
        except:
            pass
    sys.exit(0)

if __name__ == '__main__':
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    logger.info("Starting YOLO Camera Stream Server...")
    
    # Initialize camera and model
    if not initialize_camera():
        logger.error("Failed to start: Camera initialization failed")
        exit(1)
    
    if not initialize_model():
        logger.error("Failed to start: Model initialization failed")
        exit(1)
    
    # Start frame processing in background thread
    process_thread = Thread(target=process_frame, daemon=True)
    process_thread.start()
    
    # Start Flask server
    # Use 0.0.0.0 to allow external connections from React Native app
    logger.info("Server ready at http://0.0.0.0:5000")
    try:
        app.run(host='0.0.0.0', port=5000, threaded=True, debug=False)
    except KeyboardInterrupt:
        cleanup()
