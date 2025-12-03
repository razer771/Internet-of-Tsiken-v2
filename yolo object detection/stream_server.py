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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables
camera = None
model = None
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
    """Initialize YOLO model"""
    global model
    try:
        # Use PyTorch .pt model with optimizations
        model = YOLO("yolov8n.pt")
        # Enable GPU if available (will use CPU on Pi 5)
        model.to('cpu')  # Explicitly use CPU for Pi
        logger.info("YOLO model loaded successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to load YOLO model: {e}")
        return False

def process_frame():
    """Capture and process frames with YOLO detection"""
    global current_frame, detection_data
    
    frame_count = 0
    last_detections = None
    
    while True:
        try:
            if camera is None or model is None:
                continue
            
            # Capture frame
            frame = camera.capture_array()
            
            # Skip YOLO detection on some frames for speed (detect every 2nd frame)
            frame_count += 1
            if frame_count % 2 == 0 and last_detections is not None:
                # Reuse previous detection results
                results = last_detections
            else:
                # Run YOLO detection with optimizations
                results = model(frame, verbose=False, conf=0.5, iou=0.45, imgsz=416)
                last_detections = results
            
            # Annotate frame with detection boxes
            annotated_frame = results[0].plot()
            
            # Calculate FPS
            inference_time = results[0].speed['inference']
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
            
            # Extract detection information
            detections = []
            for box in results[0].boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                name = model.names[cls]
                detections.append({
                    'class': name,
                    'confidence': round(conf * 100, 2),
                    'bbox': box.xyxy[0].tolist()
                })
            
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
        'model': model is not None,
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
