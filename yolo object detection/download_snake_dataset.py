#!/usr/bin/env python3
"""
Download Snake Detection Dataset from Roboflow
Dataset: https://universe.roboflow.com/final-boss/snake-detect-slnkl
"""

import os
import sys

print("=" * 70)
print("🐍 SNAKE DETECTION DATASET DOWNLOADER")
print("=" * 70)
print("\nDataset: snake-detect-slnkl")
print("Workspace: final-boss")
print("URL: https://universe.roboflow.com/final-boss/snake-detect-slnkl\n")

# Get API key from command line or prompt
if len(sys.argv) > 1:
    api_key = sys.argv[1]
    print(f"🔑 Using API key from argument: {api_key[:8]}...\n")
else:
    print("=" * 70)
    print("ROBOFLOW API KEY REQUIRED")
    print("=" * 70)
    print("""
To download this dataset, you need a FREE Roboflow API key.

Quick steps (30 seconds):
1. Visit: https://app.roboflow.com/
2. Sign up/login (free account)
3. Go to: https://app.roboflow.com/settings/api
4. Copy your API key

Then run this script with your API key:
    python3 download_snake_dataset.py YOUR_API_KEY

OR run without arguments and paste when prompted.
""")
    
    api_key = input("\n📝 Paste your Roboflow API key here: ").strip()
    
    if not api_key:
        print("\n❌ No API key provided. Exiting.")
        print("\nTo download manually:")
        print("1. Visit: https://universe.roboflow.com/final-boss/snake-detect-slnkl")
        print("2. Click 'Download Dataset' → 'YOLOv8' format")
        print("3. Follow the code snippet provided")
        sys.exit(1)

# Download dataset
print(f"\n🔑 API Key: {api_key[:8]}...")
print("📥 Downloading dataset from Roboflow...\n")

try:
    from roboflow import Roboflow
    
    # Initialize Roboflow
    rf = Roboflow(api_key=api_key)
    
    # Get project
    print("🌐 Connecting to project: final-boss/snake-detect-slnkl...")
    project = rf.workspace("final-boss").project("snake-detect-slnkl")
    
    # Download dataset (version 1, YOLOv8 format)
    print("📦 Downloading version 1 in YOLOv8 format...")
    print("⏳ This may take a few minutes depending on dataset size...\n")
    
    dataset = project.version(1).download("yolov8")
    
    print("\n" + "=" * 70)
    print("✅ DOWNLOAD COMPLETE!")
    print("=" * 70)
    print(f"\n📁 Dataset location: {dataset.location}")
    print(f"📊 Configuration file: {dataset.location}/data.yaml")
    
    # Read and display dataset info
    try:
        import yaml
        
        with open(f"{dataset.location}/data.yaml", 'r') as f:
            data = yaml.safe_load(f)
        
        print(f"\n🏷️  Classes detected in dataset:")
        for i, class_name in enumerate(data.get('names', [])):
            print(f"   {i}: {class_name}")
        
        # Count images
        train_path = f"{dataset.location}/train/images"
        valid_path = f"{dataset.location}/valid/images"
        
        if os.path.exists(train_path):
            train_count = len([f for f in os.listdir(train_path) if f.endswith(('.jpg', '.png', '.jpeg'))])
            print(f"\n📸 Training images: {train_count}")
        
        if os.path.exists(valid_path):
            valid_count = len([f for f in os.listdir(valid_path) if f.endswith(('.jpg', '.png', '.jpeg'))])
            print(f"✅ Validation images: {valid_count}")
        
    except Exception as e:
        print(f"⚠️  Could not read dataset details: {e}")
    
    print("\n" + "=" * 70)
    print("🎯 NEXT STEP: TRAIN THE MODEL")
    print("=" * 70)
    print(f"""
Your snake detection dataset is ready for training!

OPTION 1: Quick Train (Automated)
----------------------------------
Run the training script:

    cd ~/Internet-of-Tsiken-v2/yolo\\ object\\ detection/
    python3 train_predator_model.py

Then:
- Choose option 'b' (I already have a dataset)
- Enter path: {dataset.location}

OPTION 2: Manual Train (Custom control)
----------------------------------------
Run this command:

    cd ~/Internet-of-Tsiken-v2/yolo\\ object\\ detection/
    python3 -c "
from ultralytics import YOLO

model = YOLO('yolov8n.pt')
results = model.train(
    data='{dataset.location}/data.yaml',
    epochs=50,
    imgsz=416,
    batch=8,
    device='cpu',
    patience=10,
    project='runs/snake_detection',
    name='yolov8n_snake',
)
model.save('yolov8n_snake.pt')
print('✅ Model saved as: yolov8n_snake.pt')
"

Training will take 30-60 minutes on Raspberry Pi 5.
After training, update stream_server.py to use the new model!
""")
    
except ImportError:
    print("\n❌ ERROR: roboflow package not installed!")
    print("\nInstall it with:")
    print("    pip3 install roboflow --break-system-packages")
    print("\nThen run this script again.")
    sys.exit(1)

except Exception as e:
    print(f"\n❌ ERROR downloading dataset: {e}")
    print("\nTroubleshooting:")
    print("1. Check your API key is correct")
    print("2. Verify internet connection")
    print("3. Make sure you have access to this dataset")
    print("\nManual download:")
    print("   https://universe.roboflow.com/final-boss/snake-detect-slnkl")
    sys.exit(1)
