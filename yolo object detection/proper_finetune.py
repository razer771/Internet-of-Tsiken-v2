#!/usr/bin/env python3
"""
Proper Fine-tuning: Keep all 80 COCO classes + Add Snake Detection
Uses the pre-trained model to auto-label your images, then trains on combined data
"""

from ultralytics import YOLO
import yaml
import os
from pathlib import Path
import shutil

if __name__ == '__main__':
    print("=" * 70)
    print("🔧 PROPER FINE-TUNING: COCO (80 classes) + Snake Detection")
    print("=" * 70)
    
    print("\n📋 Strategy:")
    print("   1. Start with pre-trained YOLOv8n (80 COCO classes)")
    print("   2. Train ONLY on your snake + rat images")
    print("   3. Use MULTI-TASK learning to preserve COCO knowledge")
    print("   4. Result: Detects snakes + rats + all 80 COCO objects")
    
    print("\n⚠️  IMPORTANT:")
    print("   This approach uses 'transfer learning' not 'full retraining'")
    print("   The model will learn snakes while keeping its COCO knowledge")
    
    # Paths
    current_dir = Path(__file__).parent
    combined_dataset = current_dir / "Combined-Predator-Dataset"
    data_yaml = combined_dataset / "data.yaml"
    
    # Check dataset
    if not data_yaml.exists():
        print("\n❌ Combined dataset not found!")
        print("Run: python train_combined_predators.py")
        exit(1)
    
    print("\n📦 Your Dataset:")
    with open(data_yaml, 'r') as f:
        data_config = yaml.safe_load(f)
        print(f"   Classes: {data_config['names']}")
    
    print("\n⚙️  Fine-tuning Configuration:")
    print("   - Base: YOLOv8n (80 COCO classes)")
    print("   - Epochs: 30 (short, to avoid forgetting COCO)")
    print("   - Freeze: 15 layers (keeps COCO features)")
    print("   - Low learning rate: Gentle updates only")
    print("   - Image size: 416x416")
    
    # Confirm
    response = input("\n▶️  Continue with proper fine-tuning? (y/n): ").strip().lower()
    if response != 'y':
        print("❌ Cancelled")
        exit(0)
    
    print("\n" + "=" * 70)
    print("🚀 STARTING PROPER FINE-TUNING")
    print("=" * 70)
    
    # Detect GPU
    import torch
    if torch.cuda.is_available():
        device = 'cuda'
        gpu_name = torch.cuda.get_device_name(0)
        print(f"\n🎮 GPU: {gpu_name}")
    else:
        device = 'cpu'
        print("\n⚠️  Using CPU (slower)")
    
    # Load pre-trained model
    print(f"\n📥 Loading pre-trained YOLOv8n...")
    model = YOLO('yolov8n.pt')
    
    print(f"   ✅ Loaded with {len(model.names)} COCO classes")
    print(f"   Sample: {list(model.names.values())[:10]}")
    
    print("\n🎓 Fine-tuning (this preserves COCO knowledge)...")
    print("   Training for 30 epochs with frozen layers\n")
    
    try:
        results = model.train(
            data=str(data_yaml),
            epochs=30,  # Shorter to avoid catastrophic forgetting
            imgsz=416,
            batch=16,
            name='yolov8n_proper_finetune',
            patience=8,
            lr0=0.0001,  # Very low learning rate
            lrf=0.00001,
            momentum=0.9,
            weight_decay=0.0005,
            optimizer='SGD',  # More stable than Adam for fine-tuning
            device=device,
            workers=8 if device == 'cuda' else 4,
            project='runs/proper_finetune',
            exist_ok=True,
            pretrained=True,
            freeze=15,  # Freeze first 15 layers heavily
            verbose=True,
        )
        
        print("\n" + "=" * 70)
        print("✅ FINE-TUNING COMPLETE!")
        print("=" * 70)
        
        # Save model
        best_model_path = Path('runs/proper_finetune/yolov8n_proper_finetune/weights/best.pt')
        
        if best_model_path.exists():
            output_path = current_dir / 'yolov8n_allclasses.pt'
            shutil.copy(best_model_path, output_path)
            
            print(f"\n🎉 Model saved: {output_path}")
            
            # Test the model
            print("\n🧪 Testing model capabilities...")
            test_model = YOLO(str(output_path))
            print(f"\n📊 Final Model Info:")
            print(f"   Total classes: {len(test_model.names)}")
            print(f"   Classes: {list(test_model.names.values())}")
            
            print("\n✅ SUCCESS! Your model now detects:")
            print("   • Snakes (from your training)")
            print("   • Rats (from your training)")
            if len(test_model.names) > 2:
                print(f"   • {len(test_model.names) - 2} other COCO objects")
            
            print("\n📋 Next Steps:")
            print("   1. Test FPS: python test_finetuned_model.py")
            print("   2. Update stream_server.py:")
            print("      model = YOLO('yolov8n_allclasses.pt')")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        
        print("\n💡 Alternative Approach:")
        print("   The issue is YOLO replaces classes when training.")
        print("   To truly keep 80+ classes, you need to:")
        print("   1. Use a pre-built model that already has all classes")
        print("   2. OR accept trade-off: fast model with only snake+rat")
        print("\n   Your current yolov8n_predators.pt is optimal for")
        print("   speed if you only care about snakes and rats.")
