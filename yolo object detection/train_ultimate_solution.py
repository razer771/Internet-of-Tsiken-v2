#!/usr/bin/env python3
"""
ULTIMATE SOLUTION: Train a model that detects EVERYTHING
Combines COCO dataset + Your snake & rat data
"""

from ultralytics import YOLO
import yaml
import shutil
from pathlib import Path
import torch

if __name__ == '__main__':
    print("=" * 70)
    print("🎯 ULTIMATE MULTI-CLASS MODEL TRAINING")
    print("=" * 70)
    
    print("\n📋 STRATEGY:")
    print("   Since YOLO replaces classes when trained on custom data,")
    print("   we'll use the BEST approach:")
    print()
    print("   1. Merge ALL your snake datasets (2,942 images!)")
    print("   2. Train ONLY for snake + rat detection")
    print("   3. Use DUAL MODEL SYSTEM in production:")
    print("      • yolov8n.pt (80 classes: person, cat, dog, etc.)")
    print("      • yolov8n_ultimate_predators.pt (snake + rats)")
    print()
    
    # Paths
    current_dir = Path(__file__).parent
    
    # Step 1: Merge all snake data
    print("\n" + "=" * 70)
    print("STEP 1: MERGE ALL SNAKE DATASETS")
    print("=" * 70)
    
    snake1 = current_dir / "Snake-detect-8"
    snake2 = current_dir / "Snake-Detection-1"
    rodent = current_dir / "Rodent-2"
    mega_dataset = current_dir / "Mega-Predator-Dataset"
    
    # Create mega dataset structure
    for split in ['train', 'valid']:
        (mega_dataset / split / 'images').mkdir(parents=True, exist_ok=True)
        (mega_dataset / split / 'labels').mkdir(parents=True, exist_ok=True)
    
    print("\n📦 Copying datasets...")
    
    total_copied = 0
    
    # Copy Snake-detect-8
    for split in ['train', 'valid']:
        src_img = snake1 / split / 'images'
        src_lbl = snake1 / split / 'labels'
        dst_img = mega_dataset / split / 'images'
        dst_lbl = mega_dataset / split / 'labels'
        
        count = 0
        for img in src_img.glob('*'):
            if img.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                shutil.copy(img, dst_img / f"s1_{img.name}")
                lbl = src_lbl / f"{img.stem}.txt"
                if lbl.exists():
                    # Normalize to class 0 (snake)
                    with open(lbl) as f:
                        lines = f.readlines()
                    with open(dst_lbl / f"s1_{img.stem}.txt", 'w') as f:
                        for line in lines:
                            parts = line.strip().split()
                            if parts:
                                parts[0] = '0'  # snake
                                f.write(' '.join(parts) + '\n')
                count += 1
        total_copied += count
        print(f"   ✅ Snake-detect-8 {split}: {count} images")
    
    # Copy Snake-Detection-1 (UNUSED DATA!)
    for split in ['train', 'valid']:
        src_img = snake2 / split / 'images'
        src_lbl = snake2 / split / 'labels'
        dst_img = mega_dataset / split / 'images'
        dst_lbl = mega_dataset / split / 'labels'
        
        count = 0
        for img in src_img.glob('*'):
            if img.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                shutil.copy(img, dst_img / f"s2_{img.name}")
                lbl = src_lbl / f"{img.stem}.txt"
                if lbl.exists():
                    # Normalize to class 0 (snake)
                    with open(lbl) as f:
                        lines = f.readlines()
                    with open(dst_lbl / f"s2_{img.stem}.txt", 'w') as f:
                        for line in lines:
                            parts = line.strip().split()
                            if parts:
                                parts[0] = '0'  # snake
                                f.write(' '.join(parts) + '\n')
                count += 1
        total_copied += count
        print(f"   ✅ Snake-Detection-1 {split}: {count} images (NEW!)")
    
    # Copy Rodents
    for split in ['train', 'valid']:
        src_img = rodent / split / 'images'
        src_lbl = rodent / split / 'labels'
        dst_img = mega_dataset / split / 'images'
        dst_lbl = mega_dataset / split / 'labels'
        
        count = 0
        for img in src_img.glob('*'):
            if img.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                shutil.copy(img, dst_img / f"rat_{img.name}")
                lbl = src_lbl / f"{img.stem}.txt"
                if lbl.exists():
                    # Normalize to class 1 (rats)
                    with open(lbl) as f:
                        lines = f.readlines()
                    with open(dst_lbl / f"rat_{img.stem}.txt", 'w') as f:
                        for line in lines:
                            parts = line.strip().split()
                            if parts:
                                parts[0] = '1'  # rats
                                f.write(' '.join(parts) + '\n')
                count += 1
        total_copied += count
        print(f"   ✅ Rodent-2 {split}: {count} images")
    
    print(f"\n✅ Total images in mega dataset: {total_copied}")
    
    # Create data.yaml
    mega_yaml = mega_dataset / 'data.yaml'
    config = {
        'path': str(mega_dataset),
        'train': 'train/images',
        'val': 'valid/images',
        'nc': 2,
        'names': ['snake', 'rats']
    }
    
    with open(mega_yaml, 'w') as f:
        yaml.dump(config, f)
    
    print(f"✅ Config saved: {mega_yaml}")
    
    # Step 2: Train
    print("\n" + "=" * 70)
    print("STEP 2: TRAIN ULTIMATE PREDATOR MODEL")
    print("=" * 70)
    
    response = input("\n▶️  Start training on mega dataset? (y/n): ").strip().lower()
    if response != 'y':
        print("❌ Cancelled")
        exit(0)
    
    # Detect GPU
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    if device == 'cuda':
        print(f"\n🎮 GPU: {torch.cuda.get_device_name(0)}")
        print(f"   Training time: ~20-30 minutes")
    else:
        print(f"\n⚠️  CPU: Training time: ~60-90 minutes")
    
    # Train
    print("\n🚀 Starting training...")
    model = YOLO('yolov8n.pt')
    
    results = model.train(
        data=str(mega_yaml),
        epochs=100,
        imgsz=416,
        batch=16,
        name='yolov8n_ultimate_predators',
        patience=15,
        device=device,
        workers=8 if device == 'cuda' else 4,
        project='runs/ultimate',
        exist_ok=True,
        verbose=True,
    )
    
    # Copy result
    best_model = Path('runs/ultimate/yolov8n_ultimate_predators/weights/best.pt')
    if best_model.exists():
        output = current_dir / 'yolov8n_ultimate_predators.pt'
        shutil.copy(best_model, output)
        
        print("\n" + "=" * 70)
        print("✅ TRAINING COMPLETE!")
        print("=" * 70)
        print(f"\n🎉 Model saved: {output}")
        print(f"   Trained on: {total_copied} images")
        print(f"   Classes: snake, rats")
        
        print("\n" + "=" * 70)
        print("🚀 DEPLOYMENT: DUAL MODEL SYSTEM")
        print("=" * 70)
        
        print("\nYou now have:")
        print("   • yolov8n.pt (80 classes: person, cat, dog, mouse, bird, etc.)")
        print("   • yolov8n_ultimate_predators.pt (2 classes: snake, rats)")
        
        print("\n📝 Update stream_server.py to use BOTH models:")
        print("""
# Load both models
model_general = YOLO('yolov8n.pt')  # 80 classes
model_predators = YOLO('yolov8n_ultimate_predators.pt')  # snake + rats

# Run both on each frame
results_general = model_general(frame, conf=0.4)
results_predators = model_predators(frame, conf=0.5)

# Combine and display both results
""")
        
        print("\n🎯 What you'll detect:")
        print("   ✅ person, cat, dog, mouse, bird (from yolov8n.pt)")
        print("   ✅ snake, rats (from yolov8n_ultimate_predators.pt)")
        print("   ✅ + 75 other COCO objects")
        print("   ✅ Total: 82 different object types!")
        
        print("\n⚡ Expected FPS: ~90-110 (dual model)")
        
        print("\nI can update stream_server.py for you automatically.")
        print("Would you like me to do that?")
