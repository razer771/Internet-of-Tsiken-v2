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
model_general = None  # For 80 COCO classes (person, cat, dog, etc.)
model_predators = None  # For snake + rats
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
    """Initialize DUAL YOLO models for comprehensive detection"""
    global model_general, model_predators
    try:
        # Model 1: General objects (80 COCO classes)
        logger.info("Loading general detection model (yolov8n.pt)...")
        model_general = YOLO("yolov8n.pt")
        model_general.to('cpu')
        logger.info(f"✅ General model: person, cat, dog, mouse, bird + 75 others")
        
        # Model 2: Predators (snakes + rats) - IMPROVED with 58% more training data
        logger.info("Loading predator detection model (yolov8n_ultimate_predators.pt)...")
        model_predators = YOLO("yolov8n_ultimate_predators.pt")
        model_predators.to('cpu')
        logger.info(f"✅ Predator model: snake, rats (ULTIMATE - 3,293 images)")
        
        logger.info("🎯 DUAL MODEL SYSTEM ACTIVE - Detecting ALL predators + general objects")
        return True
    except Exception as e:
        logger.error(f"Failed to load YOLO models: {e}")
        return False

def process_frame():
    """Capture and process frames with DUAL YOLO detection"""
    global current_frame, detection_data
    
    frame_count = 0
    last_results_general = None
    last_results_predators = None
    
    while True:
        try:
            if camera is None or model_general is None or model_predators is None:
                continue
            
            # Capture frame
            frame = camera.capture_array()
            
            # Skip YOLO detection on some frames for speed (detect every 2nd frame)
            frame_count += 1
            if frame_count % 2 == 0 and last_results_general is not None:
                # Reuse previous detection results
                results_general = last_results_general
                results_predators = last_results_predators
            else:
                # Run BOTH models
                results_general = model_general(frame, verbose=False, conf=0.4, iou=0.45, imgsz=416)
                results_predators = model_predators(frame, verbose=False, conf=0.5, iou=0.45, imgsz=416)
                last_results_general = results_general
                last_results_predators = results_predators
            
            # Start with general model annotations
            annotated_frame = results_general[0].plot()
            
            # Draw predator detections on top (RED boxes)
            for box in results_predators[0].boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                name = model_predators.names[cls]
                
                # Draw red box for predators
                cv2.rectangle(annotated_frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
                label = f'{name} {conf:.2f}'
                cv2.putText(annotated_frame, label, (int(x1), int(y1)-10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
            
            # Calculate FPS (average of both models)
            inference_time = (results_general[0].speed['inference'] + results_predators[0].speed['inference']) / 2
            fps = 1000 / inference_time if inference_time > 0 else 0
            
            # Add FPS text to frame
            cv2.putText(
                annotated_frame, 
                f'FPS: {fps:.1f} (Dual)', 
                (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.7, 
                (0, 255, 0), 
                2
            )
            
            # Combine detections from BOTH models
            detections = []
            
            # Add general detections
            for box in results_general[0].boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                name = model_general.names[cls]
                detections.append({
                    'class': name,
                    'confidence': round(conf * 100, 2),
                    'bbox': box.xyxy[0].tolist(),
                    'model': 'general'
                })
            
            # Add predator detections
            for box in results_predators[0].boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                name = model_predators.names[cls]
                detections.append({
                    'class': name,
                    'confidence': round(conf * 100, 2),
                    'bbox': box.xyxy[0].tolist(),
                    'model': 'predator'
                })
            
            # Log detections to console (only when objects are detected and detection changed)
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
        'model_general': model_general is not None,
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
