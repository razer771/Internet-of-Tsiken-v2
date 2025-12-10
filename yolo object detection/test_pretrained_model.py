"""
Test script to compare pre-trained YOLO models vs custom trained model
Measures FPS and detection accuracy for rat/snake detection
"""

import cv2
import time
import numpy as np
from picamera2 import Picamera2
from ultralytics import YOLO
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Models to test
MODELS_TO_TEST = {
    'YOLOv8n (Pretrained)': 'yolov8n.pt',
    'YOLOv11n (Pretrained)': 'yolo11n.pt', 
    'Custom Predators': 'yolov8n_predators.pt'
}

# Classes we care about (COCO dataset includes these)
TARGET_CLASSES = ['snake', 'rat', 'mouse', 'bird']

def initialize_camera():
    """Initialize camera with optimized settings"""
    try:
        camera = Picamera2()
        camera.preview_configuration.main.size = (416, 416)
        camera.preview_configuration.main.format = "RGB888"
        camera.preview_configuration.align()
        camera.configure("preview")
        camera.start()
        time.sleep(2)  # Warm up
        logger.info("✅ Camera initialized")
        return camera
    except Exception as e:
        logger.error(f"❌ Camera init failed: {e}")
        return None

def test_model(model_name, model_path, camera, test_frames=100):
    """Test a model and measure FPS"""
    logger.info(f"\n{'='*60}")
    logger.info(f"Testing: {model_name}")
    logger.info(f"Model: {model_path}")
    logger.info(f"{'='*60}")
    
    try:
        # Load model
        model = YOLO(model_path)
        model.to('cpu')
        
        # Get class names
        class_names = model.names
        logger.info(f"Model classes: {list(class_names.values())[:20]}...")  # Show first 20
        
        # Check if target classes exist
        target_in_model = [cls for cls in TARGET_CLASSES if cls in class_names.values()]
        logger.info(f"Target classes found: {target_in_model}")
        
        fps_list = []
        detection_count = 0
        detections_by_class = {}
        
        logger.info(f"Running {test_frames} frames test...\n")
        
        for i in range(test_frames):
            # Capture frame
            frame = camera.capture_array()
            
            # Time the inference
            start_time = time.time()
            results = model(frame, verbose=False, conf=0.4, iou=0.45, imgsz=416)
            inference_time = (time.time() - start_time) * 1000  # ms
            
            # Calculate FPS
            fps = 1000 / inference_time if inference_time > 0 else 0
            fps_list.append(fps)
            
            # Count detections
            for box in results[0].boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                name = class_names[cls]
                
                # Track all detections
                if name not in detections_by_class:
                    detections_by_class[name] = 0
                detections_by_class[name] += 1
                detection_count += 1
                
                # Log target class detections
                if name in TARGET_CLASSES:
                    logger.info(f"  🎯 Frame {i+1}: Detected {name} ({conf*100:.1f}%) - {fps:.1f} FPS")
            
            # Progress indicator every 20 frames
            if (i + 1) % 20 == 0:
                avg_fps = np.mean(fps_list[-20:])
                logger.info(f"  Progress: {i+1}/{test_frames} frames | Avg FPS: {avg_fps:.1f}")
        
        # Calculate statistics
        avg_fps = np.mean(fps_list)
        min_fps = np.min(fps_list)
        max_fps = np.max(fps_list)
        std_fps = np.std(fps_list)
        
        # Results
        logger.info(f"\n{'─'*60}")
        logger.info(f"📊 RESULTS for {model_name}:")
        logger.info(f"{'─'*60}")
        logger.info(f"  Average FPS: {avg_fps:.2f}")
        logger.info(f"  Min FPS: {min_fps:.2f}")
        logger.info(f"  Max FPS: {max_fps:.2f}")
        logger.info(f"  Std Dev: {std_fps:.2f}")
        logger.info(f"  Total Detections: {detection_count}")
        
        if detections_by_class:
            logger.info(f"  Detected Objects:")
            for obj_class, count in sorted(detections_by_class.items(), key=lambda x: x[1], reverse=True):
                logger.info(f"    - {obj_class}: {count}")
        else:
            logger.info(f"  No objects detected in test run")
        
        return {
            'model_name': model_name,
            'avg_fps': avg_fps,
            'min_fps': min_fps,
            'max_fps': max_fps,
            'std_fps': std_fps,
            'detections': detection_count,
            'detections_by_class': detections_by_class,
            'target_classes': target_in_model
        }
        
    except Exception as e:
        logger.error(f"❌ Error testing {model_name}: {e}")
        return None

def main():
    logger.info("🚀 YOLO Model Comparison Test")
    logger.info("Testing pre-trained models vs custom trained model")
    logger.info(f"Target classes: {TARGET_CLASSES}\n")
    
    # Initialize camera
    camera = initialize_camera()
    if not camera:
        logger.error("Cannot proceed without camera")
        return
    
    # Test all models
    results = []
    for model_name, model_path in MODELS_TO_TEST.items():
        result = test_model(model_name, model_path, camera, test_frames=100)
        if result:
            results.append(result)
        time.sleep(1)  # Brief pause between tests
    
    # Cleanup
    camera.stop()
    camera.close()
    
    # Final comparison
    logger.info(f"\n\n{'='*70}")
    logger.info("🏆 FINAL COMPARISON")
    logger.info(f"{'='*70}\n")
    
    logger.info(f"{'Model':<30} {'Avg FPS':<12} {'Detections':<15} {'Target Classes'}")
    logger.info(f"{'-'*70}")
    
    for result in results:
        target_cls = ', '.join(result['target_classes']) if result['target_classes'] else 'None'
        logger.info(
            f"{result['model_name']:<30} "
            f"{result['avg_fps']:>6.2f} FPS   "
            f"{result['detections']:>6} objects   "
            f"{target_cls}"
        )
    
    # Find best FPS
    if results:
        best_fps = max(results, key=lambda x: x['avg_fps'])
        logger.info(f"\n⚡ Fastest Model: {best_fps['model_name']} ({best_fps['avg_fps']:.2f} FPS)")
        
        # Find model with most target detections
        best_detections = max(results, key=lambda x: sum(
            count for cls, count in x['detections_by_class'].items() 
            if cls in TARGET_CLASSES
        ))
        logger.info(f"🎯 Best Detection: {best_detections['model_name']}")

if __name__ == '__main__':
    main()
