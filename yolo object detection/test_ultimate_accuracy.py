"""Test the ultimate predator model accuracy on validation images"""
from ultralytics import YOLO
import cv2
from pathlib import Path

model = YOLO('yolov8n_ultimate_predators.pt')

print('=' * 70)
print('TESTING ULTIMATE MODEL ACCURACY')
print('=' * 70)

print('\n=== SNAKE DETECTION TEST (conf=0.3) ===\n')
snake_imgs = list(Path('Snake-detect-8/valid/images').glob('*.jpg'))[:10]
snake_detected = 0
for i, img_path in enumerate(snake_imgs, 1):
    results = model(str(img_path), conf=0.3, verbose=False)
    detections = []
    for box in results[0].boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        name = model.names[cls]
        detections.append(f'{name}({conf*100:.0f}%)')
    
    if detections:
        print(f'{i}. {img_path.name}: {", ".join(detections)}')
        snake_detected += 1
    else:
        print(f'{i}. {img_path.name}: ❌ NO DETECTION')

print(f'\nSnake Detection Rate: {snake_detected}/{len(snake_imgs)} = {snake_detected/len(snake_imgs)*100:.1f}%')

print('\n=== RAT DETECTION TEST (conf=0.3) ===\n')
rat_imgs = list(Path('Rodent-2/valid/images').glob('*.jpg'))[:10]
rat_detected = 0
for i, img_path in enumerate(rat_imgs, 1):
    results = model(str(img_path), conf=0.3, verbose=False)
    detections = []
    for box in results[0].boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        name = model.names[cls]
        detections.append(f'{name}({conf*100:.0f}%)')
    
    if detections:
        print(f'{i}. {img_path.name}: {", ".join(detections)}')
        rat_detected += 1
    else:
        print(f'{i}. {img_path.name}: ❌ NO DETECTION')

print(f'\nRat Detection Rate: {rat_detected}/{len(rat_imgs)} = {rat_detected/len(rat_imgs)*100:.1f}%')

print('\n' + '=' * 70)
print('DIAGNOSIS:')
print('=' * 70)
if snake_detected < len(snake_imgs) * 0.8:
    print('❌ SNAKE DETECTION IS LOW!')
    print('   Possible causes:')
    print('   1. Model confidence threshold too high (try 0.2)')
    print('   2. Training data quality issues')
    print('   3. Class imbalance (more snakes than rats)')
else:
    print('✅ Snake detection is good')

if rat_detected < len(rat_imgs) * 0.8:
    print('⚠️  RAT DETECTION IS LOW!')
    print('   Possible causes:')
    print('   1. Not enough rat training data')
    print('   2. Model confidence threshold too high')
else:
    print('✅ Rat detection is good')
