#!/bin/bash

# Install YOLO Camera Stream Server as a systemd service
# Run with: sudo ./install_camera_service.sh

SERVICE_NAME="camera-stream"
SERVICE_FILE="camera-stream.service"
SYSTEMD_PATH="/etc/systemd/system"

echo "Installing YOLO Camera Stream Server as a systemd service..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root: sudo ./install_camera_service.sh"
    exit 1
fi

# Copy service file
echo "Copying service file to $SYSTEMD_PATH..."
cp "$SERVICE_FILE" "$SYSTEMD_PATH/$SERVICE_FILE"

# Reload systemd
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Enable service to start on boot
echo "Enabling service to start on boot..."
systemctl enable "$SERVICE_NAME"

# Start the service now
echo "Starting service..."
systemctl start "$SERVICE_NAME"

# Show status
echo ""
echo "Installation complete! Service status:"
systemctl status "$SERVICE_NAME" --no-pager

echo ""
echo "Useful commands:"
echo "  Check status:  sudo systemctl status $SERVICE_NAME"
echo "  Stop service:  sudo systemctl stop $SERVICE_NAME"
echo "  Start service: sudo systemctl start $SERVICE_NAME"
echo "  View logs:     sudo journalctl -u $SERVICE_NAME -f"
echo "  Disable boot:  sudo systemctl disable $SERVICE_NAME"
