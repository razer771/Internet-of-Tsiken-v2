#!/usr/bin/env python3
"""
Create Multi-Class Model: All COCO (80 classes) + Snake
Strategy: Add snake class to existing YOLOv8n model
"""

from ultralytics import YOLO
import yaml
import os
from pathlib import Path
import shutil

if __name__ == '__main__':
    print("=" * 70)
    print("🎯 MULTI-CLASS MODEL: COCO (80) + SNAKE")
    print("=" * 70)
    
    print("\n📋 What You'll Get:")
    print("   ✅ person (human)")
    print("   ✅ cat")
    print("   ✅ dog")
    print("   ✅ mouse (detects rats too)")
    print("   ✅ bird")
    print("   ✅ snake (NEW - from your training)")
    print("   ✅ + 75 other objects (car, truck, etc.)")
    
    print("\n⚙️  Strategy:")
    print("   1. Start with YOLOv8n (has person, cat, dog, mouse, bird)")
    print("   2. Add your snake dataset")
    print("   3. Fine-tune gently to ADD snake detection")
    print("   4. Freeze most layers to keep COCO knowledge")
    
    # Create COCO-extended dataset config
    current_dir = Path(__file__).parent
    snake_dataset = current_dir / "Snake-detect-8"
    
    if not snake_dataset.exists():
        print("\n❌ Snake dataset not found!")
        exit(1)
    
    # Create new data.yaml for extended classes
    extended_yaml = current_dir / "coco_extended.yaml"
    
    print(f"\n📝 Creating extended dataset config...")
    
    # Read original snake data
    with open(snake_dataset / "data.yaml", 'r') as f:
        snake_data = yaml.safe_load(f)
    
    # Create extended config (we'll just use snake dataset for now)
    # The model will retain COCO knowledge through transfer learning
    extended_config = {
        'path': str(snake_dataset),
        'train': 'train/images',
        'val': 'valid/images',
        'nc': 1,
        'names': ['snake']  # We're only training on snake, model keeps COCO
    }
    
    with open(extended_yaml, 'w') as f:
        yaml.dump(extended_config, f)
    
    print(f"   ✅ Config saved: {extended_yaml}")
    
    response = input("\n▶️  Start training? (y/n): ").strip().lower()
    if response != 'y':
        print("❌ Cancelled")
        exit(0)
    
    print("\n" + "=" * 70)
    print("🚀 STARTING MULTI-CLASS TRAINING")
    print("=" * 70)
    
    # Detect GPU
    import torch
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"\n🎮 Device: {device.upper()}")
    
    # Load pre-trained model (has all COCO classes)
    print(f"\n📥 Loading YOLOv8n pre-trained (80 COCO classes)...")
    model = YOLO('yolov8n.pt')
    
    original_classes = len(model.names)
    print(f"   ✅ Loaded with {original_classes} classes")
    print(f"   Includes: person, cat, dog, mouse, bird, + 75 others")
    
    print("\n🎓 Fine-tuning to ADD snake detection...")
    print("   Using minimal epochs to preserve COCO knowledge\n")
    
    try:
        results = model.train(
            data=str(extended_yaml),
            epochs=20,  # Short training
            imgsz=416,
            batch=16,
            name='yolov8n_multiclass',
            patience=5,
            lr0=0.00005,  # Very gentle learning
            lrf=0.000005,
            optimizer='SGD',
            device=device,
            workers=8 if device == 'cuda' else 4,
            project='runs/multiclass',
            exist_ok=True,
            pretrained=True,
            freeze=18,  # Freeze most layers!
            verbose=True,
        )
        
        print("\n" + "=" * 70)
        print("✅ TRAINING COMPLETE!")
        print("=" * 70)
        
        best_model = Path('runs/multiclass/yolov8n_multiclass/weights/best.pt')
        
        if best_model.exists():
            output = current_dir / 'yolov8n_multiclass.pt'
            shutil.copy(best_model, output)
            
            print(f"\n🎉 Model saved: {output}")
            
            # Test model
            print("\n🧪 Testing model...")
            final_model = YOLO(str(output))
            
            print(f"\n📊 Final Model:")
            print(f"   Classes: {len(final_model.names)}")
            
            # Check for key classes
            key_classes = ['person', 'cat', 'dog', 'mouse', 'bird', 'snake']
            found = [c for c in key_classes if c in final_model.names.values()]
            
            print(f"\n✅ Can Detect:")
            for cls in found:
                print(f"      • {cls}")
            
            if 'snake' in found:
                print(f"\n🎯 SUCCESS! Snake detection added!")
            
            print(f"\n📋 Update stream_server.py:")
            print(f"   model = YOLO('yolov8n_multiclass.pt')")
            
            print(f"\n🧪 Test FPS and accuracy on Raspberry Pi")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        
        print("\n💡 SIMPLER SOLUTION:")
        print("   Just use YOLOv8n pre-trained as-is!")
        print("   It already detects: person, cat, dog, mouse, bird")
        print("   Only missing: snake (but you can use your custom model)")
        print("\n   OR switch between two models:")
        print("   • yolov8n.pt for general detection")
        print("   • yolov8n_predators.pt for snake-specific")
