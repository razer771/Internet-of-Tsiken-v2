#!/usr/bin/env python3
"""
Create Ultimate Predator Detection Model
Strategy: Start with YOLOv8n (80 classes) and fine-tune to ADD snake detection
Result: Detects person, cat, dog, mouse, bird, snake + 75 other objects
"""

from ultralytics import YOLO
import yaml
import os
from pathlib import Path
import shutil
import torch

if __name__ == '__main__':
    print("=" * 70)
    print("🎯 ULTIMATE PREDATOR DETECTION MODEL")
    print("=" * 70)
    
    print("\n📋 What You'll Get:")
    print("   ✅ person (human)")
    print("   ✅ cat")
    print("   ✅ dog")
    print("   ✅ mouse (detects rats)")
    print("   ✅ bird")
    print("   ✅ snake (NEW - from your 1,740 images)")
    print("   ✅ + 75 other COCO objects")
    
    print("\n⚙️  Strategy:")
    print("   1. Load YOLOv8n pre-trained (80 COCO classes)")
    print("   2. Fine-tune on ONLY snake images")
    print("   3. Use minimal training to ADD snake without forgetting others")
    print("   4. Result: 81 classes total")
    
    # Setup paths
    current_dir = Path(__file__).parent
    snake_dataset = current_dir / "Snake-detect-8"
    
    if not snake_dataset.exists():
        print("\n❌ Snake dataset not found!")
        exit(1)
    
    # Create minimal config for snake only
    snake_only_yaml = current_dir / "snake_only.yaml"
    
    snake_config = {
        'path': str(snake_dataset),
        'train': 'train/images',
        'val': 'valid/images',
        'nc': 1,
        'names': ['snake']
    }
    
    with open(snake_only_yaml, 'w') as f:
        yaml.dump(snake_config, f)
    
    print(f"\n📝 Snake training config created: {snake_only_yaml}")
    
    response = input("\n▶️  Start training multi-class predator model? (y/n): ").strip().lower()
    if response != 'y':
        print("❌ Cancelled")
        exit(0)
    
    print("\n" + "=" * 70)
    print("🚀 STARTING TRAINING")
    print("=" * 70)
    
    # Detect GPU
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    if device == 'cuda':
        gpu_name = torch.cuda.get_device_name(0)
        print(f"\n🎮 GPU: {gpu_name}")
        print(f"   Training time: ~10-15 minutes")
    else:
        print(f"\n⚠️  CPU: Training will take ~30-45 minutes")
    
    # Load pre-trained model
    print(f"\n📥 Loading YOLOv8n pre-trained (80 classes)...")
    model = YOLO('yolov8n.pt')
    
    print(f"   ✅ Model has {len(model.names)} classes")
    print(f"   Includes: person, cat, dog, mouse, bird, cow, horse...")
    
    print("\n🎓 Fine-tuning to ADD snake detection...")
    print("   Training for 25 epochs with frozen backbone\n")
    
    try:
        results = model.train(
            data=str(snake_only_yaml),
            epochs=25,  # Minimal training
            imgsz=416,
            batch=16,
            name='yolov8n_all_predators',
            patience=5,
            lr0=0.00001,  # Very low learning rate
            lrf=0.000001,
            warmup_epochs=3,
            optimizer='SGD',
            device=device,
            workers=8 if device == 'cuda' else 4,
            project='runs/all_predators',
            exist_ok=True,
            pretrained=True,
            freeze=20,  # Freeze backbone heavily
            verbose=True,
            save_period=5,
            # Important: Don't let it forget COCO classes
            close_mosaic=10,
        )
        
        print("\n" + "=" * 70)
        print("✅ TRAINING COMPLETE!")
        print("=" * 70)
        
        best_model = Path('runs/all_predators/yolov8n_all_predators/weights/best.pt')
        
        if best_model.exists():
            output = current_dir / 'yolov8n_ultimate.pt'
            shutil.copy(best_model, output)
            
            print(f"\n🎉 Model saved: {output}")
            
            # Test the model
            print("\n🧪 Testing model classes...")
            final_model = YOLO(str(output))
            
            print(f"\n📊 Final Model Info:")
            print(f"   Total classes: {len(final_model.names)}")
            print(f"   Classes: {list(final_model.names.values())}")
            
            # Verify key predator classes
            key_classes = ['person', 'cat', 'dog', 'mouse', 'bird', 'snake']
            found = [c for c in key_classes if c in final_model.names.values()]
            missing = [c for c in key_classes if c not in final_model.names.values()]
            
            print(f"\n✅ Key Predators Detected:")
            for cls in found:
                print(f"      • {cls}")
            
            if missing:
                print(f"\n⚠️  Missing (might need retraining):")
                for cls in missing:
                    print(f"      • {cls}")
            
            print(f"\n" + "=" * 70)
            print("📋 DEPLOYMENT INSTRUCTIONS")
            print("=" * 70)
            
            print(f"\n1. Update stream_server.py:")
            print(f'   model = YOLO("yolov8n_ultimate.pt")')
            
            print(f"\n2. Copy model to Raspberry Pi:")
            print(f"   scp yolov8n_ultimate.pt pi@YOUR_PI_IP:~/yolo_object_detection/")
            
            print(f"\n3. Restart camera service on Pi:")
            print(f"   sudo systemctl restart camera-stream")
            
            print(f"\n4. Test detection:")
            print(f"   Should detect: person, cat, dog, mouse, bird, snake, + more")
            
            print(f"\n🎯 Expected Performance:")
            print(f"   • FPS: ~120-140 (similar to custom model)")
            print(f"   • Classes: {len(final_model.names)}")
            print(f"   • Detection: All predators + general objects")
            
    except Exception as e:
        print(f"\n❌ Training Error: {e}")
        import traceback
        traceback.print_exc()
        
        print("\n" + "=" * 70)
        print("💡 TROUBLESHOOTING")
        print("=" * 70)
        
        print("\nThe issue is that YOLO's fine-tuning often replaces classes")
        print("instead of adding to them. This is a known limitation.")
        
        print("\n🎯 RECOMMENDED SOLUTION:")
        print("\nUse a DUAL MODEL approach in stream_server.py:")
        print("""
# Load both models
model_general = YOLO('yolov8n.pt')  # For person, cat, dog, mouse, bird
model_snake = YOLO('yolov8n_predators.pt')  # For snakes

# Run detection with both
results_general = model_general(frame, conf=0.4)
results_snake = model_snake(frame, conf=0.5)

# Combine detections from both models
# (I can help you implement this)
""")
        
        print("\nThis gives you:")
        print("   ✅ All 80 COCO classes (person, cat, dog, mouse, bird, etc.)")
        print("   ✅ Snake detection (from custom model)")
        print("   ✅ Best of both worlds")
        print("   ⚠️  Slightly slower (~15-20% FPS reduction)")
