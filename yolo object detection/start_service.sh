#!/bin/bash
cd "/home/charles/Internet-of-Tsiken-v2/yolo object detection"
source venv/bin/activate
exec python3 stream_server_optimized.py
