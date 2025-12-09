# Snake & Rat Detection Setup Guide

## Current Status
Your YOLOv8n model uses **COCO dataset** with 80 classes:
- ✅ **cat** (class 15) - Already supported
- ✅ **dog** (class 16) - Already supported  
- ❌ **snake** - NOT in COCO
- ❌ **rat** - NOT in COCO

## Solution Options (Ranked by Ease)

---

## **Option 1: Use Pre-trained Roboflow Model (EASIEST - 10 minutes)**

Roboflow Universe has ready-to-use models trained on snakes and rats.

### Steps:

1. **Download a pre-trained model:**
   ```bash
   # On your Raspberry Pi
   cd ~/Internet-of-Tsiken-v2/yolo\ object\ detection/
   
   # Download snake detection model (example)
   wget https://app.roboflow.com/ds/XXXXXXXX -O snake_detector.pt
   
   # Or download from these Roboflow projects:
   # - Snake Detection: https://universe.roboflow.com/search?q=snake
   # - Rat Detection: https://universe.roboflow.com/search?q=rat
   ```

2. **Update stream_server.py to use the new model:**
   ```python
   # Change line ~15 in stream_server.py:
   model = YOLO("snake_detector.pt")  # Instead of yolov8n.pt
   ```

3. **Restart the camera server**

**Pros:** Quick, no training needed  
**Cons:** May not work perfectly in your environment

---

## **Option 2: Use YOLOv8x (Larger Model) + Custom Classes (MODERATE - 1 hour)**

Train YOLOv8 on a custom dataset with snake/rat images.

### Steps:

1. **Collect dataset from public sources:**
   - **Roboflow Universe**: Pre-labeled snake/rat datasets
   - **Kaggle**: Animal detection datasets
   - **Your own images**: Take photos of snakes/rats in your environment

2. **Use Roboflow to create custom dataset:**
   ```
   1. Go to https://roboflow.com
   2. Create free account
   3. Search "snake detection" or "rat detection"
   4. Fork a public dataset
   5. Add your own images if needed
   6. Export as "YOLOv8 PyTorch" format
   ```

3. **Download dataset to Pi:**
   ```bash
   cd ~/Internet-of-Tsiken-v2/yolo\ object\ detection/
   mkdir custom_dataset
   cd custom_dataset
   
   # Download your dataset zip from Roboflow
   # It will contain: train/, valid/, data.yaml
   ```

4. **Train/Fine-tune the model:**
   ```bash
   # Install training dependencies
   pip3 install ultralytics[export] --upgrade
   
   # Fine-tune YOLOv8n on your custom data
   python3 -c "
   from ultralytics import YOLO
   
   # Load pre-trained YOLOv8n
   model = YOLO('yolov8n.pt')
   
   # Fine-tune on your dataset
   results = model.train(
       data='custom_dataset/data.yaml',
       epochs=50,
       imgsz=416,
       device='cpu',  # Use 'cuda' if you have GPU
       patience=10
   )
   
   # Save the model
   model.save('yolov8n_predators.pt')
   "
   ```

5. **Update stream_server.py:**
   ```python
   model = YOLO("yolov8n_predators.pt")
   ```

**Pros:** Best accuracy for your specific environment  
**Cons:** Requires time to train (2-4 hours on Pi)

---

## **Option 3: Multi-Model Approach (ADVANCED - Best Results)**

Run 2 models simultaneously: one for general objects, one for predators.

### Implementation:

```python
# In stream_server.py, modify to use dual models:

from ultralytics import YOLO

# Load both models
general_model = YOLO("yolov8n.pt")  # For cats, dogs, birds
predator_model = YOLO("snake_rat_detector.pt")  # For snakes, rats

def generate_frames():
    while True:
        frame = picam2.capture_array()
        
        # Run both models
        general_results = general_model(frame, conf=0.5)
        predator_results = predator_model(frame, conf=0.3)  # Lower threshold for predators
        
        # Combine detections
        all_detections = []
        
        # Add general detections (cats, dogs, birds)
        for box in general_results[0].boxes:
            class_id = int(box.cls[0])
            if class_id in [14, 15, 16]:  # bird, cat, dog
                all_detections.append({
                    'class': general_results[0].names[class_id],
                    'confidence': float(box.conf[0]),
                    'bbox': box.xyxy[0].tolist()
                })
        
        # Add predator detections (snakes, rats)
        for box in predator_results[0].boxes:
            all_detections.append({
                'class': predator_results[0].names[int(box.cls[0])],
                'confidence': float(box.conf[0]),
                'bbox': box.xyxy[0].tolist()
            })
        
        # Annotate and encode frame...
```

---

## **Recommended Path for You:**

### **QUICK START (Use existing COCO cats/dogs + add snake/rat model):**

```bash
# 1. Search Roboflow for a combined animal model
cd ~/Internet-of-Tsiken-v2/yolo\ object\ detection/

# 2. Try this pre-trained wildlife model (example URL)
# Visit: https://universe.roboflow.com/
# Search: "animal detection" or "wildlife detection"
# Download the .pt file

# 3. Example: Using a Roboflow model
# After downloading, replace in stream_server.py:
# model = YOLO("downloaded_wildlife_model.pt")
```

### **Steps to get started NOW:**

1. **Visit Roboflow Universe:**
   - Go to https://universe.roboflow.com/search?q=snake+rat
   - Find a model with snake + rat classes
   - Click "Download Dataset" → "YOLOv8" format
   - Get the API code or direct download link

2. **Download on your Pi:**
   ```bash
   cd ~/Internet-of-Tsiken-v2/yolo\ object\ detection/
   # Use the Roboflow API or wget to download
   ```

3. **Test the new model:**
   ```bash
   python3 -c "
   from ultralytics import YOLO
   model = YOLO('your_downloaded_model.pt')
   print('Classes:', model.names)
   "
   ```

4. **If it has the classes you need, update stream_server.py**

---

## **Model Repositories to Check:**

1. **Roboflow Universe** (easiest):
   - Snake Detection: https://universe.roboflow.com/search?q=snake
   - Rat Detection: https://universe.roboflow.com/search?q=rat
   - Wildlife: https://universe.roboflow.com/search?q=wildlife

2. **Kaggle Datasets:**
   - Search "snake detection yolo"
   - Search "rat detection yolo"

3. **Ultralytics HUB:**
   - https://hub.ultralytics.com/models

---

## **Testing Your Model:**

Once you have a new model, test it:

```bash
cd ~/Internet-of-Tsiken-v2/yolo\ object\ detection/

# Test with a sample image
python3 << 'EOF'
from ultralytics import YOLO
import cv2

# Load model
model = YOLO("your_model.pt")

# Print classes
print("\nModel Classes:")
for i, name in model.names.items():
    print(f"{i}: {name}")

# Test detection
print("\nRunning test detection...")
results = model("path/to/test/image.jpg", conf=0.25)
results[0].save("test_detection.jpg")
print("✅ Saved test_detection.jpg")
EOF
```

---

## **Quick Command to Check Current Model:**

```bash
cd ~/Internet-of-Tsiken-v2/yolo\ object\ detection/
python3 -c "from ultralytics import YOLO; m=YOLO('yolov8n.pt'); print('Current classes:', list(m.names.values()))"
```

---

## **Next Steps:**

Choose one option above and let me know which path you want to take. I can help you:
1. Find a pre-trained model from Roboflow
2. Set up training with your own dataset
3. Implement multi-model detection

The **fastest path** is using a Roboflow pre-trained model - should take about 10-15 minutes total!
