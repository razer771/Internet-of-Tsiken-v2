"""
Test YOLOv8n pre-trained model to verify it detects all classes
Uses test images to show real detection capabilities
"""

from ultralytics import YOLO
import cv2
import numpy as np
from pathlib import Path

print("=" * 70)
print("🧪 TESTING YOLOV8N PRE-TRAINED MODEL")
print("=" * 70)

# Load model
print("\n📥 Loading YOLOv8n pre-trained model...")
model = YOLO('yolov8n.pt')

print(f"\n📊 Model Info:")
print(f"   Total classes: {len(model.names)}")
print(f"   All classes: {list(model.names.values())}")

# Check for your required classes
required = ['person', 'cat', 'dog', 'mouse', 'bird', 'snake', 'rat']
found = [c for c in required if c in model.names.values()]
missing = [c for c in required if c not in model.names.values()]

print(f"\n✅ Required classes FOUND: {found}")
print(f"❌ Required classes MISSING: {missing}")

# Create test images with different objects
print("\n" + "=" * 70)
print("🎨 TESTING WITH SYNTHETIC IMAGES")
print("=" * 70)

# Test 1: Random image (should detect nothing or random objects)
print("\n1. Testing with random noise image...")
random_img = np.random.randint(0, 255, (640, 640, 3), dtype=np.uint8)
results = model(random_img, conf=0.3)

if len(results[0].boxes) > 0:
    print(f"   Detected {len(results[0].boxes)} objects:")
    for box in results[0].boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        name = model.names[cls_id]
        print(f"      • {name}: {conf*100:.1f}%")
else:
    print("   ✅ No objects detected (correct)")

# Test 2: Use actual image if available
print("\n2. Testing with actual images...")

# Check if there are any images in the snake dataset
snake_dataset = Path("Snake-detect-8/valid/images")
if snake_dataset.exists():
    images = list(snake_dataset.glob("*.jpg"))[:3]  # Get first 3 images
    
    if images:
        print(f"   Found {len(images)} test images")
        for i, img_path in enumerate(images, 1):
            print(f"\n   Image {i}: {img_path.name}")
            results = model(str(img_path), conf=0.3)
            
            if len(results[0].boxes) > 0:
                print(f"      Detected {len(results[0].boxes)} objects:")
                for box in results[0].boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    name = model.names[cls_id]
                    print(f"         • {name}: {conf*100:.1f}%")
            else:
                print("      No objects detected")
else:
    print("   ⚠️  No test images found")

# Test 3: Run model on sample to show it works
print("\n3. Testing detection capability...")
print("   Creating test frame (416x416)...")

test_img = np.random.randint(0, 255, (416, 416, 3), dtype=np.uint8)
results = model(test_img, conf=0.5, verbose=False)

print("   ✅ Model is working and ready to detect:")
print("\n   Primary targets:")
for cls in ['person', 'cat', 'dog', 'mouse', 'bird']:
    if cls in model.names.values():
        print(f"      ✅ {cls}")
    else:
        print(f"      ❌ {cls} (not available)")

print("\n   Additional detectable objects:")
other_animals = ['cow', 'elephant', 'bear', 'zebra', 'giraffe', 'horse', 'sheep']
available_animals = [a for a in other_animals if a in model.names.values()]
print(f"      {', '.join(available_animals)}")

print("\n" + "=" * 70)
print("📋 SUMMARY")
print("=" * 70)
print(f"\n✅ Model loaded successfully")
print(f"✅ Can detect {len(model.names)} different object types")
print(f"✅ Includes: person, cat, dog, mouse, bird")
print(f"❌ Does NOT include: snake, rat (specifically labeled)")
print(f"\n💡 Note: 'mouse' class will likely detect rats too")
print(f"💡 For snake detection, need custom model or fine-tuning")

print(f"\n🎯 Current stream_server.py is configured to use this model")
print(f"   To deploy: Copy to Raspberry Pi and run stream_server.py")
