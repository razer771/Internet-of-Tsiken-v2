## How to Fix: Camera Only Detecting Rodents

### Problem:
The `yolov8n.pt` file on your Raspberry Pi is actually the old custom model (2 classes: snake, rodents) instead of the pre-trained model (80 classes).

### Solution:

**On Raspberry Pi, run these commands:**

```bash
cd ~/yolo_object_detection

# Backup old model
mv yolov8n.pt yolov8n_old_backup.pt

# Download fresh pre-trained YOLOv8n (80 classes)
wget https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt

# Verify it has 80 classes
python3 -c "from ultralytics import YOLO; model = YOLO('yolov8n.pt'); print(f'Classes: {len(model.names)}'); print(model.names)"

# Restart the camera server
sudo systemctl restart camera-stream
# OR if running manually:
python3 stream_server.py
```

### Alternative: Use Your Custom Model (Faster)

If you want to keep detecting only snake + rodents with better performance:

**Edit `stream_server.py` on Raspberry Pi:**
```python
model = YOLO("yolov8n_predators.pt")  # Only detects snake + rodents
```

Then restart the service.

### Quick Check:

After fixing, the camera should detect:
- ✅ person
- ✅ cat  
- ✅ dog
- ✅ mouse
- ✅ bird
- ✅ + 75 other objects

If you still only see "rodents", the model file wasn't replaced properly.
