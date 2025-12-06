from ultralytics import YOLO
import os

# Load the trained model
model = YOLO('yolov8n_predators.pt')

print("=" * 60)
print("TESTING PREDATOR DETECTION MODEL")
print("=" * 60)

print(f"\n✅ Model classes: {model.names}")
print(f"📊 Confidence threshold: {model.overrides.get('conf', 0.25)}")

# Test on a snake image
snake_imgs = os.listdir('Snake-detect-8/valid/images')
if snake_imgs:
    test_img = os.path.join('Snake-detect-8', 'valid', 'images', snake_imgs[0])
    print(f"\n🧪 Testing on: {os.path.basename(test_img)}")
    
    results = model(test_img, conf=0.25, verbose=False)
    
    print(f"\n🎯 Detections found: {len(results[0].boxes)}")
    
    if len(results[0].boxes) > 0:
        for i, box in enumerate(results[0].boxes):
            cls = int(box.cls)
            conf = box.conf.item()
            print(f"   {i+1}. {model.names[cls]} - Confidence: {conf:.2%}")
    else:
        print("   ⚠️ No detections found!")
        print("\n💡 Possible issues:")
        print("   - Image might be too different from training data")
        print("   - Confidence threshold too high")
        print("   - Try lowering conf parameter")

# Test on a rat image
rat_imgs = os.listdir('Rodent-2/valid/images')
if rat_imgs:
    test_img = os.path.join('Rodent-2', 'valid', 'images', rat_imgs[0])
    print(f"\n🧪 Testing on: {os.path.basename(test_img)}")
    
    results = model(test_img, conf=0.25, verbose=False)
    
    print(f"\n🎯 Detections found: {len(results[0].boxes)}")
    
    if len(results[0].boxes) > 0:
        for i, box in enumerate(results[0].boxes):
            cls = int(box.cls)
            conf = box.conf.item()
            print(f"   {i+1}. {model.names[cls]} - Confidence: {conf:.2%}")
    else:
        print("   ⚠️ No detections found!")

print("\n" + "=" * 60)
