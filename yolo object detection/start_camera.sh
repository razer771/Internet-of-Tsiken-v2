#!/bin/bash

# Simple camera server startup script (local network only)
# No Cloudflare tunnel - faster streaming on same network

echo "🎥 Starting Camera Server (Local Network Only)..."

# Kill any existing camera server
pkill -f stream_server.py

# Start camera server
cd "$(dirname "$0")"
python stream_server.py &

sleep 3

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ Camera Server Started!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 Local URL: http://$LOCAL_IP:5000"
echo "🏠 Hostname:  http://rpi5desktop.local:5000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 The app will auto-detect the camera server"
echo "   Click 'Detect Camera' button in the app"
echo ""
echo "Press Ctrl+C to stop the server"

# Keep script running
tail -f /dev/null
