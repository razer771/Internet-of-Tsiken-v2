#!/usr/bin/env python3
"""
Automated Predator Detection Model Training Script
This script will train a YOLOv8 model to detect snakes, rats, cats, dogs, and birds
"""

import os
import sys
from ultralytics import YOLO

def install_dependencies():
    """Install required packages"""
    print("📦 Installing dependencies...")
    os.system("pip3 install roboflow ultralytics --quiet")

def download_dataset():
    """
    Download predator detection dataset from Roboflow
    
    NOTE: You need a Roboflow API key (free)
    Get it from: https://app.roboflow.com/
    """
    print("\n" + "="*70)
    print("ROBOFLOW SETUP REQUIRED")
    print("="*70)
    print("""
To download training data, you need a FREE Roboflow account:

1. Go to: https://app.roboflow.com/
2. Sign up (free, takes 1 minute)
3. Go to: https://app.roboflow.com/settings/api
4. Copy your API key

Then run this script with your API key:
    python3 train_predator_model.py YOUR_API_KEY

OR

Search for a public dataset and paste the download code here.
""")
    
    api_key = input("\n📝 Enter your Roboflow API key (or press Enter to skip): ").strip()
    
    if not api_key:
        print("\n⚠️  Skipping dataset download.")
        print("You can manually download a dataset from:")
        print("   https://universe.roboflow.com/search?q=snake+rat")
        print("\nThen place it in: ./custom_dataset/")
        return False
    
    try:
        from roboflow import Roboflow
        
        print(f"\n🔑 Using API key: {api_key[:8]}...")
        rf = Roboflow(api_key=api_key)
        
        # Try to download a public wildlife dataset
        # You can replace this with any specific dataset you find
        print("\n🌐 Searching for wildlife detection datasets...")
        print("💡 Tip: Browse https://universe.roboflow.com/ to find specific datasets")
        print("    Look for datasets with 'snake', 'rat', 'wildlife' tags\n")
        
        workspace = input("Enter workspace name (from Roboflow URL): ").strip()
        project = input("Enter project name (from Roboflow URL): ").strip()
        version = input("Enter version number (usually 1): ").strip() or "1"
        
        print(f"\n📥 Downloading {workspace}/{project}/v{version}...")
        
        project = rf.workspace(workspace).project(project)
        dataset = project.version(int(version)).download("yolov8")
        
        print(f"✅ Dataset downloaded to: {dataset.location}")
        return dataset.location
        
    except Exception as e:
        print(f"\n❌ Error downloading dataset: {e}")
        print("\nYou can manually download instead:")
        print("1. Visit: https://universe.roboflow.com/")
        print("2. Search for 'wildlife detection' or 'snake rat'")
        print("3. Download as YOLOv8 format")
        print("4. Extract to: ./custom_dataset/")
        return False

def train_model(dataset_path=None):
    """Train YOLOv8 model on custom dataset"""
    
    if not dataset_path:
        # Check if user manually placed dataset
        if os.path.exists("./custom_dataset/data.yaml"):
            dataset_path = "./custom_dataset"
        else:
            print("\n❌ No dataset found!")
            print("Please download a dataset first.")
            return False
    
    print("\n" + "="*70)
    print("STARTING TRAINING")
    print("="*70)
    
    data_yaml = os.path.join(dataset_path, "data.yaml")
    
    if not os.path.exists(data_yaml):
        print(f"❌ data.yaml not found in {dataset_path}")
        return False
    
    print(f"\n📊 Dataset: {data_yaml}")
    print("🎯 Base model: YOLOv8n (your current model)")
    print("⏱️  Estimated time: 30-60 minutes on Raspberry Pi 5")
    print("🔥 This will use CPU training (slower but works)\n")
    
    proceed = input("Start training? (y/n): ").strip().lower()
    
    if proceed != 'y':
        print("❌ Training cancelled.")
        return False
    
    try:
        # Load pre-trained YOLOv8n model
        print("\n🤖 Loading YOLOv8n base model...")
        model = YOLO('yolov8n.pt')
        
        # Train/fine-tune on custom dataset
        print("\n🏋️  Starting training...")
        print("💡 Tip: This will take a while. You can monitor progress below.\n")
        
        results = model.train(
            data=data_yaml,
            epochs=50,              # Number of training iterations
            imgsz=416,              # Image size (matches your current setup)
            batch=8,                # Batch size (adjust if memory issues)
            device='cpu',           # Use CPU (Pi 5 doesn't have CUDA)
            patience=10,            # Early stopping patience
            save=True,              # Save checkpoints
            project='runs/predator_detection',
            name='yolov8n_predators',
            exist_ok=True,
            pretrained=True,        # Start from pre-trained weights
            optimizer='SGD',        # Optimizer
            lr0=0.01,              # Initial learning rate
            weight_decay=0.0005,   # Weight decay
        )
        
        # Save the final model
        model_path = "yolov8n_predators.pt"
        model.save(model_path)
        
        print("\n" + "="*70)
        print("✅ TRAINING COMPLETE!")
        print("="*70)
        print(f"\n📦 Trained model saved to: {model_path}")
        print(f"📊 Training results in: runs/predator_detection/yolov8n_predators/")
        
        # Test the model
        print("\n🧪 Testing model...")
        test_results = model.val()
        
        print(f"\n📈 Model Performance:")
        print(f"   mAP50: {test_results.box.map50:.3f}")
        print(f"   mAP50-95: {test_results.box.map:.3f}")
        
        # Show detected classes
        print(f"\n🏷️  Model can detect these classes:")
        for i, name in model.names.items():
            print(f"   {i}: {name}")
        
        print("\n" + "="*70)
        print("NEXT STEPS:")
        print("="*70)
        print(f"""
1. Update stream_server.py to use the new model:
   
   Change line ~15:
   model = YOLO("yolov8n_predators.pt")

2. Restart your camera server:
   cd ~/Internet-of-Tsiken-v2/yolo\\ object\\ detection/
   ./start_camera.sh

3. Test with your app!

The model is now trained to detect predators specific to your dataset! 🎉
""")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        return False

def main():
    """Main training pipeline"""
    
    print("="*70)
    print("🐍🐀 PREDATOR DETECTION MODEL TRAINER")
    print("="*70)
    print("""
This script will help you train a YOLOv8 model to detect:
- Snakes
- Rats
- Cats
- Dogs
- Birds
- Other animals

Two options:
1. Download dataset from Roboflow (requires free account)
2. Use your own dataset (place in ./custom_dataset/)
""")
    
    # Check if API key provided as argument
    api_key = sys.argv[1] if len(sys.argv) > 1 else None
    
    print("\n📦 Step 1: Install dependencies")
    install_dependencies()
    
    print("\n📥 Step 2: Get dataset")
    print("\nOptions:")
    print("  a) Download from Roboflow (recommended)")
    print("  b) I already have a dataset in ./custom_dataset/")
    print("  c) Skip for now\n")
    
    choice = input("Choose option (a/b/c): ").strip().lower()
    
    dataset_path = None
    
    if choice == 'a':
        dataset_path = download_dataset()
    elif choice == 'b':
        if os.path.exists("./custom_dataset/data.yaml"):
            dataset_path = "./custom_dataset"
            print(f"✅ Found dataset at: {dataset_path}")
        else:
            print("❌ No dataset found in ./custom_dataset/")
            print("Please download a dataset and place it there.")
            return
    else:
        print("\n💡 To get a dataset:")
        print("1. Visit: https://universe.roboflow.com/")
        print("2. Search: 'wildlife detection' or 'snake rat detection'")
        print("3. Download in YOLOv8 format")
        print("4. Extract to: ./custom_dataset/")
        print("5. Run this script again")
        return
    
    if dataset_path:
        print("\n🏋️  Step 3: Train model")
        train_model(dataset_path)
    else:
        print("\n⚠️  Setup incomplete. Please get a dataset first.")

if __name__ == "__main__":
    main()
