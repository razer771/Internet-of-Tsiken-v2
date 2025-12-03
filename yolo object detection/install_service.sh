#!/bin/bash

# Install Camera Server as Systemd Service
# This makes the camera server start automatically on boot

echo "📦 Installing YOLO Camera Server as systemd service..."

# Get the absolute path to the yolo directory
YOLO_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PYTHON_PATH=$(which python3)
USER=$(whoami)

echo "📍 Installation directory: $YOLO_DIR"
echo "🐍 Python path: $PYTHON_PATH"
echo "👤 Running as user: $USER"

# Create systemd service file
sudo tee /etc/systemd/system/yolo-camera.service > /dev/null <<EOF
[Unit]
Description=YOLO Camera Stream Server for Internet of Tsiken
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$YOLO_DIR
ExecStart=$PYTHON_PATH $YOLO_DIR/stream_server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment variables
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Service file created at /etc/systemd/system/yolo-camera.service"

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable yolo-camera.service

# Start the service now
sudo systemctl start yolo-camera.service

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ YOLO Camera Server installed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Service Management Commands:"
echo ""
echo "  Check status:   sudo systemctl status yolo-camera"
echo "  Stop service:   sudo systemctl stop yolo-camera"
echo "  Start service:  sudo systemctl start yolo-camera"
echo "  Restart:        sudo systemctl restart yolo-camera"
echo "  View logs:      sudo journalctl -u yolo-camera -f"
echo "  Disable:        sudo systemctl disable yolo-camera"
echo ""
echo "🚀 The camera server will now start automatically on boot!"
echo ""

# Show current status
sleep 2
sudo systemctl status yolo-camera --no-pager
