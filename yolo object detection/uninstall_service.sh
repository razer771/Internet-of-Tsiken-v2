#!/bin/bash

# Uninstall YOLO Camera Server systemd service

echo "🗑️  Uninstalling YOLO Camera Server service..."

# Stop the service
sudo systemctl stop yolo-camera.service

# Disable the service
sudo systemctl disable yolo-camera.service

# Remove the service file
sudo rm /etc/systemd/system/yolo-camera.service

# Reload systemd
sudo systemctl daemon-reload

echo ""
echo "✅ YOLO Camera Server service uninstalled successfully!"
echo "   You can now run the server manually if needed."
echo ""
