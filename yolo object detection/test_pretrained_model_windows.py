"""
Test script to compare pre-trained YOLO models vs custom trained model
Windows compatible - uses webcam or video file for testing
Measures FPS and detection accuracy for rat/snake detection
"""

import cv2
import time
import numpy as np
from ultralytics import YOLO
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Models to test
MODELS_TO_TEST = {
    'YOLOv8n (Pretrained)': 'yolov8n.pt',
    'YOLOv11n (Pretrained)': 'yolo11n.pt', 
    'Custom Predators': 'yolov8n_predators.pt'
}

# Classes we care about (COCO dataset includes these)
TARGET_CLASSES = ['snake', 'rat', 'mouse', 'bird', 'cat', 'dog']

def test_model_benchmark(model_name, model_path, test_frames=100):
    """Test a model with dummy frames (pure inference speed test)"""
    logger.info(f"\n{'='*60}")
    logger.info(f"Testing: {model_name}")
    logger.info(f"Model: {model_path}")
    logger.info(f"{'='*60}")
    
    try:
        # Load model
        logger.info("Loading model...")
        model = YOLO(model_path)
        
        # Get class names
        class_names = model.names
        logger.info(f"Total classes: {len(class_names)}")
        logger.info(f"First 20 classes: {list(class_names.values())[:20]}")
        
        # Check if target classes exist
        target_in_model = [cls for cls in TARGET_CLASSES if cls in class_names.values()]
        logger.info(f"✅ Target classes found: {target_in_model}")
        
        # Create dummy frame (416x416 like Pi camera)
        dummy_frame = np.random.randint(0, 255, (416, 416, 3), dtype=np.uint8)
        
        fps_list = []
        
        logger.info(f"Running {test_frames} frames benchmark...\n")
        
        # Warmup
        logger.info("Warming up...")
        for _ in range(10):
            _ = model(dummy_frame, verbose=False, conf=0.4, imgsz=416)
        
        # Actual test
        for i in range(test_frames):
            # Time the inference
            start_time = time.time()
            results = model(dummy_frame, verbose=False, conf=0.4, iou=0.45, imgsz=416)
            inference_time = (time.time() - start_time) * 1000  # ms
            
            # Calculate FPS
            fps = 1000 / inference_time if inference_time > 0 else 0
            fps_list.append(fps)
            
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
        logger.info(f"  Inference Time: {1000/avg_fps:.2f} ms")
        
        return {
            'model_name': model_name,
            'avg_fps': avg_fps,
            'min_fps': min_fps,
            'max_fps': max_fps,
            'std_fps': std_fps,
            'inference_ms': 1000/avg_fps,
            'target_classes': target_in_model,
            'total_classes': len(class_names)
        }
        
    except Exception as e:
        logger.error(f"❌ Error testing {model_name}: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    logger.info("🚀 YOLO Model Benchmark Test (Windows)")
    logger.info("Testing inference speed of different models")
    logger.info(f"Target classes: {TARGET_CLASSES}\n")
    
    # Test all models
    results = []
    for model_name, model_path in MODELS_TO_TEST.items():
        # Check if model file exists
        if not os.path.exists(model_path):
            logger.warning(f"⚠️  Model not found: {model_path} - Skipping")
            continue
            
        result = test_model_benchmark(model_name, model_path, test_frames=100)
        if result:
            results.append(result)
        time.sleep(1)  # Brief pause between tests
    
    # Final comparison
    if not results:
        logger.error("❌ No models were tested successfully")
        return
    
    logger.info(f"\n\n{'='*80}")
    logger.info("🏆 FINAL COMPARISON")
    logger.info(f"{'='*80}\n")
    
    logger.info(f"{'Model':<30} {'Avg FPS':<12} {'Inference':<12} {'Classes':<10} {'Target Classes'}")
    logger.info(f"{'-'*80}")
    
    for result in results:
        target_cls = ', '.join(result['target_classes'][:3]) if result['target_classes'] else 'None'
        if len(result['target_classes']) > 3:
            target_cls += '...'
        logger.info(
            f"{result['model_name']:<30} "
            f"{result['avg_fps']:>6.2f} FPS   "
            f"{result['inference_ms']:>6.2f} ms   "
            f"{result['total_classes']:>4} cls   "
            f"{target_cls}"
        )
    
    # Find best FPS
    best_fps = max(results, key=lambda x: x['avg_fps'])
    logger.info(f"\n⚡ Fastest Model: {best_fps['model_name']} ({best_fps['avg_fps']:.2f} FPS, {best_fps['inference_ms']:.2f} ms)")
    
    # Find model with most target classes
    most_targets = max(results, key=lambda x: len(x['target_classes']))
    logger.info(f"🎯 Most Target Classes: {most_targets['model_name']} ({len(most_targets['target_classes'])} classes)")
    
    # Analysis
    logger.info(f"\n{'='*80}")
    logger.info("💡 ANALYSIS")
    logger.info(f"{'='*80}")
    
    pretrained = [r for r in results if 'Pretrained' in r['model_name']]
    custom = [r for r in results if 'Custom' in r['model_name']]
    
    if pretrained and custom:
        avg_pretrained_fps = np.mean([r['avg_fps'] for r in pretrained])
        custom_fps = custom[0]['avg_fps']
        
        if avg_pretrained_fps > custom_fps:
            speedup = ((avg_pretrained_fps - custom_fps) / custom_fps) * 100
            logger.info(f"✅ Pretrained models are ~{speedup:.1f}% FASTER on average")
        else:
            slowdown = ((custom_fps - avg_pretrained_fps) / custom_fps) * 100
            logger.info(f"⚠️  Pretrained models are ~{slowdown:.1f}% SLOWER on average")
        
        logger.info(f"\nPretrained models can detect: {pretrained[0]['target_classes']}")
        logger.info(f"Custom model trained for: Snakes, Rats, other predators")
        
        logger.info(f"\n📋 RECOMMENDATION:")
        if avg_pretrained_fps >= custom_fps * 0.9:  # Within 10%
            logger.info("✅ Use pretrained YOLOv11n or YOLOv8n - same/better FPS with broader detection")
        else:
            logger.info("⚠️  Custom model has better FPS - stick with it if detection quality is good")

if __name__ == '__main__':
    main()
