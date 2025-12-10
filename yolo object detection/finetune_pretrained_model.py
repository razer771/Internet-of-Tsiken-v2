#!/usr/bin/env python3
"""
Fine-tune Pre-trained YOLOv8n on Custom Snake + Rat Dataset
This keeps the model's existing knowledge (80 classes) and adds snake detection
"""

from ultralytics import YOLO
import yaml
import os
from pathlib import Path

if __name__ == '__main__':
    print("=" * 70)
    print("🔧 FINE-TUNING YOLOV8N ON SNAKE + RAT DATASET")
    print("=" * 70)
    
    # Paths
    current_dir = Path(__file__).parent
    combined_dataset = current_dir / "Combined-Predator-Dataset"
    data_yaml = combined_dataset / "data.yaml"
    
    # Check if dataset exists
    if not data_yaml.exists():
        print("\n❌ Combined dataset not found!")
        print("Run this first: python train_combined_predators.py")
        exit(1)
    
    print("\n📦 Dataset Configuration:")
    with open(data_yaml, 'r') as f:
        data_config = yaml.safe_load(f)
        print(f"   Classes: {data_config['names']}")
        print(f"   Training images: {combined_dataset / 'train' / 'images'}")
        print(f"   Validation images: {combined_dataset / 'valid' / 'images'}")
    
    print("\n🎯 Fine-tuning Strategy:")
    print("   Base: Pre-trained YOLOv8n (80 COCO classes)")
    print("   + Your custom snake + rat data")
    print("   = Model that knows EVERYTHING")
    
    print("\n⚙️  Training Configuration:")
    print("   - Epochs: 50 (faster than training from scratch)")
    print("   - Image size: 416x416 (optimized for Pi Camera)")
    print("   - Batch size: 16 (adjust based on your RAM)")
    print("   - Learning rate: Lower (0.001) to preserve existing knowledge")
    
    # Ask for confirmation
    response = input("\n▶️  Start fine-tuning? (y/n): ").strip().lower()
    if response != 'y':
        print("❌ Cancelled")
        exit(0)
    
    print("\n" + "=" * 70)
    print("🚀 STARTING FINE-TUNING")
    print("=" * 70)
    
    # Detect GPU
    import torch
    if torch.cuda.is_available():
        device = 'cuda'
        gpu_name = torch.cuda.get_device_name(0)
        print(f"\n🎮 GPU Detected: {gpu_name}")
        print(f"   CUDA Version: {torch.version.cuda}")
        print(f"   GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    else:
        device = 'cpu'
        print("\n⚠️  No GPU detected - using CPU (will be slower)")
    
    # Load pre-trained model
    print(f"\n📥 Loading pre-trained YOLOv8n model on {device.upper()}...")
    model = YOLO('yolov8n.pt')
    
    print("\n📊 Pre-trained model info:")
    print(f"   Total classes: {len(model.names)}")
    print(f"   Sample classes: {list(model.names.values())[:10]}...")
    
    # Fine-tune on custom dataset
    print("\n🎓 Fine-tuning on your snake + rat dataset...")
    if device == 'cuda':
        print("   ⚡ Training with GPU - should take 10-20 minutes\n")
    else:
        print("   ⏳ Training with CPU - will take 30-60 minutes\n")
    
    try:
        results = model.train(
            data=str(data_yaml),
            epochs=50,
            imgsz=416,
            batch=16,
            name='yolov8n_finetuned_predators',
            patience=10,  # Early stopping
            lr0=0.001,  # Lower learning rate to preserve pre-trained knowledge
            lrf=0.0001,
            optimizer='AdamW',
            save=True,
            save_period=10,  # Save checkpoint every 10 epochs
            device=device,  # Auto-detected: 'cuda' for GPU or 'cpu'
            workers=8 if device == 'cuda' else 4,  # More workers with GPU
            project='runs/finetune',
            exist_ok=True,
            pretrained=True,
            verbose=True,
            # Freeze early layers to preserve general features
            freeze=10,  # Freeze first 10 layers
        )
        
        print("\n" + "=" * 70)
        print("✅ FINE-TUNING COMPLETE!")
        print("=" * 70)
        
        # Find the best model
        best_model_path = Path('runs/finetune/yolov8n_finetuned_predators/weights/best.pt')
        
        if best_model_path.exists():
            print(f"\n🎉 Best model saved to:")
            print(f"   {best_model_path}")
            
            # Copy to root directory
            import shutil
            output_path = current_dir / 'yolov8n_finetuned.pt'
            shutil.copy(best_model_path, output_path)
            print(f"\n📦 Model also copied to:")
            print(f"   {output_path}")
            
            print("\n📊 Training Results:")
            print(f"   Final mAP: Check runs/finetune/yolov8n_finetuned_predators/results.png")
            
            print("\n🧪 Test your new model:")
            print("   1. Update stream_server.py to use 'yolov8n_finetuned.pt'")
            print("   2. Deploy to Raspberry Pi")
            print("   3. Compare FPS vs your custom model")
            
            print("\n💡 Expected Benefits:")
            print("   ✅ Detects snakes (your data)")
            print("   ✅ Detects rats/mice (your data + pre-trained)")
            print("   ✅ Detects birds, cats, dogs (pre-trained)")
            print("   ✅ Potentially faster inference")
            print("   ✅ Better generalization")
        
    except Exception as e:
        print(f"\n❌ Error during training: {e}")
        print("\nTroubleshooting:")
        print("   - Reduce batch size if out of memory")
        print("   - Check dataset paths in data.yaml")
        print("   - Ensure ultralytics is installed: pip install ultralytics")
        exit(1)
    
    print("\n" + "=" * 70)
    print("🎓 NEXT STEPS")
    print("=" * 70)
    print("\n1. Compare models:")
    print("   python test_pretrained_model_windows.py")
    print("\n2. Update your stream_server.py:")
    print("   model = YOLO('yolov8n_finetuned.pt')")
    print("\n3. Deploy to Raspberry Pi and test FPS")
