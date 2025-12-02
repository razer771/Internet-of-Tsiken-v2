from ultralytics import YOLO

model = YOLO("yolov5n.pt")

model.export(format="ncnn")