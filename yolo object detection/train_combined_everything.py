#!/usr/bin/env python3
"""
Train YOLOv8 to detect BOTH:
- 80 COCO classes (person, car, dog, cat, bird, etc.)
- 2 Predator classes (snake, rodent)

This creates a model with 82 total classes by training on your predator dataset
while preserving COCO knowledge through transfer learning.
"""

from ultralytics import YOLO
import torch

def train_combined_model():
    """Train model that detects COCO + predators"""
    
    # Start with COCO-pretrained model (80 classes)
    print("Loading YOLOv8n COCO pretrained model...")
    model = YOLO("yolov8n.pt")
    
    # Check if GPU available (use on laptop/PC, not Pi 5)
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Using device: {device}")
    
    if device == 'cpu':
        print("\n⚠️  WARNING: Training on CPU will be VERY slow!")
        print("   Recommended: Run this on a laptop/PC with GPU or Google Colab")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            print("Cancelled. Run this script on a faster machine.")
            return
    
    # Train on predator dataset
    # This will ADD snake/rodent classes while keeping COCO knowledge
    print("\nStarting training...")
    print("This will create a model with 82 classes:")
    print("  - 80 COCO classes (person, car, dog, cat, etc.)")
    print("  - 2 Predator classes (snake, rodent)")
    
    results = model.train(
        data='combined_predators/data.yaml',  # Your snake/rat dataset
        epochs=50,                            # Adjust based on your time
        imgsz=640,                            # Standard YOLO size
        batch=16,                             # Adjust based on GPU memory
        name='yolov8n_coco_plus_predators',   # Output folder name
        patience=10,                          # Early stopping
        save=True,
        device=device,
        pretrained=True,                      # Keep COCO weights
        
        # Transfer learning settings
        freeze=10,                            # Freeze first 10 layers (keeps COCO features)
    )
    
    print("\n✅ Training complete!")
    print(f"Model saved to: runs/predator_detection/yolov8n_coco_plus_predators/weights/best.pt")
    print("\nTo use this model, update stream_server.py:")
    print('  model = YOLO("runs/predator_detection/yolov8n_coco_plus_predators/weights/best.pt")')

if __name__ == "__main__":
    train_combined_model()
