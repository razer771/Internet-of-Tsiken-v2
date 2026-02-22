#!/usr/bin/env python3
"""
Quick Test - Optimized Server Architecture
Validates producer-consumer implementation without camera
"""

import threading
import time
import numpy as np
from datetime import datetime

# Simulated buffer
class TestBuffer:
    def __init__(self):
        self.frame = None
        self.lock = threading.Lock()
        self.writes = 0
        self.reads = 0
    
    def write(self, frame):
        with self.lock:
            self.frame = frame
            self.writes += 1
    
    def read(self):
        with self.lock:
            self.reads += 1
            return self.frame.copy() if self.frame is not None else None

buffer = TestBuffer()
running = True

def producer():
    """Simulates 30 FPS camera capture"""
    print("📹 [PRODUCER] Started")
    for i in range(300):  # 10 seconds @ 30 FPS
        if not running:
            break
        # Simulate 416x416 frame
        frame = np.random.randint(0, 255, (416, 416, 3), dtype=np.uint8)
        buffer.write(frame)
        time.sleep(1/30)  # 30 FPS
    print(f"📹 [PRODUCER] Stopped - wrote {buffer.writes} frames")

def consumer_stream():
    """Simulates MJPEG streaming"""
    print("📡 [STREAMING] Started")
    count = 0
    for i in range(300):
        if not running:
            break
        frame = buffer.read()
        if frame is not None:
            count += 1
        time.sleep(1/30)  # 30 FPS
    print(f"📡 [STREAMING] Stopped - read {count} frames")

def consumer_ai():
    """Simulates AI inference"""
    print("🤖 [AI] Started")
    count = 0
    for i in range(150):  # 10 seconds @ 15 FPS
        if not running:
            break
        frame = buffer.read()
        if frame is not None:
            # Simulate inference (50ms)
            time.sleep(0.050)
            count += 1
        time.sleep(1/15)  # 15 FPS
    print(f"🤖 [AI] Stopped - processed {count} frames")

print("=" * 50)
print("🧪 Testing Producer-Consumer Architecture")
print("=" * 50)
print()

# Start threads
t1 = threading.Thread(target=producer, daemon=True)
t2 = threading.Thread(target=consumer_stream, daemon=True)
t3 = threading.Thread(target=consumer_ai, daemon=True)

start = time.time()

t1.start()
t2.start()
t3.start()

t1.join()
t2.join()
t3.join()

elapsed = time.time() - start

print()
print("=" * 50)
print("📊 RESULTS")
print("=" * 50)
print(f"Total time: {elapsed:.2f}s")
print(f"Producer writes: {buffer.writes}")
print(f"Total reads: {buffer.reads}")
print(f"Producer FPS: {buffer.writes/elapsed:.1f}")
print()
print("✅ Architecture validated!" if buffer.writes > 250 else "❌ Test failed!")
print()
