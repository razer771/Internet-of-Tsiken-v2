#!/bin/bash
# Start Optimized YOLO Camera Stream Server
# Producer-Consumer Architecture for Raspberry Pi 5

echo "========================================"
echo "🚀 Starting Optimized Camera Server"
echo "========================================"

# Navigate to script directory
cd "$(dirname "$0")"

# Check if model is exported
if [ ! -d "models/yolov8s-custom_ncnn_model" ]; then
    echo ""
    echo "⚠️  NCNN model not found!"
    echo "📦 Exporting yolov8s-custom.pt to NCNN format..."
    echo ""
    python3 export_model_to_ncnn.py
    
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ Model export failed!"
        echo "💡 Falling back to PyTorch (slower performance)"
        echo ""
        sleep 2
    fi
fi

# Check if dependencies are installed
echo ""
echo "🔍 Checking dependencies..."
python3 -c "import ncnn" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  NCNN not installed - installing now..."
    pip3 install ncnn==1.0.20240729
fi

echo ""
echo "✅ Starting server with optimized architecture:"
echo "   - Thread 1: Camera capture @ 30 FPS"
echo "   - Thread 2: MJPEG streaming"
echo "   - Thread 3: AI inference (NCNN)"
echo ""
echo "📡 Server will be available at:"
echo "   http://$(hostname).local:5000"
echo "   http://$(hostname -I | awk '{print $1}'):5000"
echo ""

# Start the optimized server
python3 stream_server_optimized.py
