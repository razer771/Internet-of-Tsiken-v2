"""
Test the fine-tuned model and compare with custom model
"""
import cv2
import time
import numpy as np
from ultralytics import YOLO
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Models to test
MODELS_TO_TEST = {
    'Fine-tuned YOLOv8n': 'yolov8n_finetuned.pt',
    'Custom Predators': 'yolov8n_predators.pt'
}

# Target classes
TARGET_CLASSES = ['snake', 'rodents', 'mouse', 'rat', 'bird', 'cat', 'dog']

def test_model(model_name, model_path, test_frames=100):
    """Test a model and measure FPS"""
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
        logger.info(f"All classes: {list(class_names.values())}")
        
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
            'total_classes': len(class_names),
            'all_classes': list(class_names.values())
        }
        
    except Exception as e:
        logger.error(f"❌ Error testing {model_name}: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    logger.info("🚀 Fine-tuned Model Comparison Test")
    logger.info("Testing fine-tuned model vs custom trained model\n")
    
    # Test all models
    results = []
    for model_name, model_path in MODELS_TO_TEST.items():
        result = test_model(model_name, model_path, test_frames=100)
        if result:
            results.append(result)
        time.sleep(1)
    
    # Final comparison
    if not results:
        logger.error("❌ No models were tested successfully")
        return
    
    logger.info(f"\n\n{'='*80}")
    logger.info("🏆 FINAL COMPARISON")
    logger.info(f"{'='*80}\n")
    
    logger.info(f"{'Model':<30} {'Avg FPS':<12} {'Inference':<12} {'Classes':<10} {'Can Detect'}")
    logger.info(f"{'-'*80}")
    
    for result in results:
        target_cls = ', '.join(result['target_classes'][:5]) if result['target_classes'] else 'None'
        if len(result['target_classes']) > 5:
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
    
    # Analysis
    logger.info(f"\n{'='*80}")
    logger.info("💡 ANALYSIS")
    logger.info(f"{'='*80}")
    
    finetuned = next((r for r in results if 'Fine-tuned' in r['model_name']), None)
    custom = next((r for r in results if 'Custom' in r['model_name']), None)
    
    if finetuned and custom:
        fps_diff = finetuned['avg_fps'] - custom['avg_fps']
        fps_percent = (fps_diff / custom['avg_fps']) * 100
        
        logger.info(f"\nFine-tuned model:")
        logger.info(f"  • FPS: {finetuned['avg_fps']:.2f} ({fps_percent:+.1f}% vs custom)")
        logger.info(f"  • Classes: {finetuned['total_classes']} total")
        logger.info(f"  • Can detect: {', '.join(finetuned['all_classes'])}")
        
        logger.info(f"\nCustom model:")
        logger.info(f"  • FPS: {custom['avg_fps']:.2f}")
        logger.info(f"  • Classes: {custom['total_classes']} (snake, rodents only)")
        
        logger.info(f"\n📋 RECOMMENDATION:")
        if fps_diff >= -5:  # Within 5 FPS
            logger.info(f"✅ USE FINE-TUNED MODEL!")
            logger.info(f"   • Similar FPS ({finetuned['avg_fps']:.1f} vs {custom['avg_fps']:.1f})")
            logger.info(f"   • Detects {finetuned['total_classes']} classes (vs {custom['total_classes']})")
            logger.info(f"   • Better generalization")
            logger.info(f"   • Update stream_server.py: model = YOLO('yolov8n_finetuned.pt')")
        else:
            logger.info(f"⚠️  Fine-tuned model is {abs(fps_percent):.1f}% slower")
            logger.info(f"   Consider using custom model if FPS is critical")

if __name__ == '__main__':
    main()
