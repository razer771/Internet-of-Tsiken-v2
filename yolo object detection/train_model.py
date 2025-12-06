from ultralytics import YOLO

# Load a pretrained YOLOv8n model
model = YOLO('yolov8n.pt')

# Train the model
results = model.train(
    data='Combined-Predator-Dataset/data.yaml',
    epochs=50,
    imgsz=640,
    batch=8,
    name='predator_detection'
)

print("Training complete!")
print(f"Best model saved at: {results.save_dir}")
