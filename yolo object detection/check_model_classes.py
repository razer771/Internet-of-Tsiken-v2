#!/usr/bin/env python3
"""Check what classes are in each model"""

from ultralytics import YOLO

models = {
    "COCO Base": "yolov8n_coco.pt",
    "Finetuned": "yolov8n_finetuned.pt",
}

for name, path in models.items():
    try:
        model = YOLO(path)
        print(f"\n{'='*60}")
        print(f"Model: {name} ({path})")
        print(f"{'='*60}")
        print(f"Total classes: {len(model.names)}")
        print(f"Classes: {model.names}")
    except Exception as e:
        print(f"\n{name}: Error - {e}")
