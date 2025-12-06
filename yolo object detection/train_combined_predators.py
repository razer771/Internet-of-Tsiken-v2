#!/usr/bin/env python3
"""
Combined Predator Detection Training
Trains YOLOv8 to detect both snakes and rats
"""

from ultralytics import YOLO
import yaml
import os
import shutil
from pathlib import Path
import gc

# Memory optimization
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'

if __name__ == '__main__':
    print("=" * 70)
    print("🐍🐀 COMBINED SNAKE & RAT DETECTION TRAINING")
    print("=" * 70)

    # Dataset paths - use current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    snake_dataset = os.path.join(current_dir, "Snake-detect-8")
    rat_dataset = os.path.join(current_dir, "Rodent-2")
    combined_dataset = os.path.join(current_dir, "Combined-Predator-Dataset")

    print(f"\n📦 Dataset 1 (Snakes): {snake_dataset}")
    print(f"📦 Dataset 2 (Rats): {rat_dataset}")
    print(f"🎯 Combined output: {combined_dataset}\n")

    # Create combined dataset directory
    os.makedirs(f"{combined_dataset}/train/images", exist_ok=True)
    os.makedirs(f"{combined_dataset}/train/labels", exist_ok=True)
    os.makedirs(f"{combined_dataset}/valid/images", exist_ok=True)
    os.makedirs(f"{combined_dataset}/valid/labels", exist_ok=True)

    print("📁 Creating combined dataset structure...")

    # Read snake dataset info
    with open(f"{snake_dataset}/data.yaml", 'r') as f:
        snake_data = yaml.safe_load(f)

    snake_classes = snake_data['names']
    print(f"\n🐍 Snake classes ({len(snake_classes)}):")
    for i, name in enumerate(snake_classes):
        print(f"   {i}: {name}")

    # Copy snake images and labels
    print("\n📋 Copying snake dataset...")
    for split in ['train', 'valid']:
        # Copy images
        snake_images = Path(f"{snake_dataset}/{split}/images")
        for img in snake_images.glob("*"):
            if img.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                shutil.copy(img, f"{combined_dataset}/{split}/images/snake_{img.name}")
        
        # Copy and normalize labels (all snake classes become class 0)
        snake_labels = Path(f"{snake_dataset}/{split}/labels")
        for lbl in snake_labels.glob("*.txt"):
            with open(lbl, 'r') as f:
                lines = f.readlines()
            
            # Normalize all snake detections to class 0
            normalized_lines = []
            for line in lines:
                parts = line.strip().split()
                if parts:
                    # Set class ID to 0 (snake)
                    parts[0] = '0'
                    normalized_lines.append(' '.join(parts) + '\n')
            
            with open(f"{combined_dataset}/{split}/labels/snake_{lbl.name}", 'w') as f:
                f.writelines(normalized_lines)

    print("✅ Snake dataset copied")

    # Copy rat dataset and adjust class IDs
    print("\n📋 Copying rat dataset and adjusting labels...")
    rat_class_offset = len(snake_classes)  # Rats start after snake classes

    for split in ['train', 'valid']:
        # Copy images
        rat_images = Path(f"{rat_dataset}/{split}/images")
        for img in rat_images.glob("*"):
            if img.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                shutil.copy(img, f"{combined_dataset}/{split}/images/rat_{img.name}")
        
        # Copy and adjust labels (normalize all rat detections to class 1)
        rat_labels = Path(f"{rat_dataset}/{split}/labels")
        for lbl in rat_labels.glob("*.txt"):
            with open(lbl, 'r') as f:
                lines = f.readlines()
            
            # Normalize all rat detections to class 1
            adjusted_lines = []
            for line in lines:
                parts = line.strip().split()
                if parts:
                    # Set class ID to 1 (rodents)
                    parts[0] = '1'
                    adjusted_lines.append(' '.join(parts) + '\n')
            
            with open(f"{combined_dataset}/{split}/labels/rat_{lbl.name}", 'w') as f:
                f.writelines(adjusted_lines)

    print("✅ Rat dataset copied and labels adjusted")

    # Create combined data.yaml
    combined_classes = snake_classes + ['rodents']

    data_yaml_content = f"""# Combined Predator Detection Dataset
# Snakes + Rats

path: {combined_dataset}
train: train/images
val: valid/images

# Classes
nc: {len(combined_classes)}
names: {combined_classes}
"""

    with open(f"{combined_dataset}/data.yaml", 'w') as f:
        f.write(data_yaml_content)

    print("\n✅ Combined data.yaml created")

    # Count total images
    train_count = len(list(Path(f"{combined_dataset}/train/images").glob("*")))
    valid_count = len(list(Path(f"{combined_dataset}/valid/images").glob("*")))

    print("\n" + "=" * 70)
    print("📊 COMBINED DATASET SUMMARY")
    print("=" * 70)
    print(f"\n🏷️  Total classes: {len(combined_classes)}")
    for i, name in enumerate(combined_classes):
        print(f"   {i}: {name}")

    print(f"\n📸 Training images: {train_count}")
    print(f"✅ Validation images: {valid_count}")
    print(f"📊 Total images: {train_count + valid_count}")

    # Start training
    print("\n" + "=" * 70)
    print("🏋️  STARTING TRAINING")
    print("=" * 70)
    print("\n⏱️  Estimated time: 30-60 minutes on Raspberry Pi 5")
    print("📊 Training will detect ALL these predators:")
    for name in combined_classes:
        print(f"   • {name}")

    print("\n🔥 Training configuration:")
    print("   • Base model: YOLOv8n (pre-trained on COCO)")
    print("   • Epochs: 50 (with early stopping)")
    print("   • Image size: 416x416 (matches camera resolution)")
    print("   • Batch size: 2 (optimized for memory)")
    print("   • Device: GPU (NVIDIA RTX 4050)")
    print("   • Optimizer: SGD with learning rate 0.01")
    print("   • Workers: 2 (reduced for memory)")
    print("   • Cache: False (memory saving)")

    proceed = input("\n▶️  Start training? (y/n): ").strip().lower()

    if proceed != 'y':
        print("\n❌ Training cancelled.")
        print(f"💡 Dataset ready at: {combined_dataset}")
        print("   You can train later by running this script again.")
        exit(0)

    print("\n🤖 Loading YOLOv8n base model...")
    model = YOLO('yolov8n.pt')

    print("🏋️  Starting training...\n")

    results = model.train(
        data=f"{combined_dataset}/data.yaml",
        epochs=50,
        imgsz=416,  # Match camera resolution
        batch=2,  # Further reduced for memory with larger images
        device=0,  # Use GPU 0 (NVIDIA RTX 4050)
        patience=10,
        project='runs/predator_detection',
        name='yolov8n_predators',
        save=True,
        pretrained=True,
        optimizer='SGD',
        lr0=0.01,
        weight_decay=0.0005,
        verbose=True,
        workers=2,  # Reduce CPU workers to save RAM
        cache=False,  # Don't cache images in RAM
    )

    print("\n💾 Saving trained model...")
    model.save('yolov8n_predators.pt')

    print("\n" + "=" * 70)
    print("✅ TRAINING COMPLETE!")
    print("=" * 70)

    print(f"\n📦 Trained model saved as: yolov8n_predators.pt")
    print(f"📊 Training results in: runs/predator_detection/yolov8n_predators/")

    # Test the model
    print("\n🧪 Validating model...")
    test_results = model.val()

    print(f"\n📈 Model Performance:")
    print(f"   mAP50: {test_results.box.map50:.3f}")
    print(f"   mAP50-95: {test_results.box.map:.3f}")

    print(f"\n🏷️  Model can detect these classes:")
    for i, name in model.names.items():
        print(f"   {i}: {name}")

    print("\n" + "=" * 70)
    print("🎯 NEXT STEPS")
    print("=" * 70)
    print("""
1. Update stream_server.py to use the new model:
   
   Edit line ~15 in stream_server.py:
   model = YOLO("yolov8n_predators.pt")

2. Restart your camera server:
   cd ~/Internet-of-Tsiken-v2/yolo\ object\ detection/
   pkill -f stream_server.py
   python3 stream_server.py &

3. Test with your app!
   The camera will now detect:
   • 6 types of snakes (Cobra, Python, etc.)
   • Rodents (rats, mice)
   • Plus existing COCO classes (cats, dogs, birds)

🎉 Your chicken coop is now protected from predators!
""")
