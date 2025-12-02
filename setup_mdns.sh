#!/bin/bash
# setup_mdns.sh - Enable mDNS so Pi is always reachable via hostname

echo "Setting up mDNS for automatic network discovery..."

# Ensure Avahi is installed and running
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

# Get hostname
HOSTNAME=$(hostname)

echo ""
echo "✅ mDNS Setup Complete!"
echo ""
echo "═══════════════════════════════════════════════"
echo "Your Pi is now accessible on ANY network via:"
echo "  http://${HOSTNAME}.local:5000"
echo "═══════════════════════════════════════════════"
echo ""
echo "This works on:"
echo "  • Home WiFi"
echo "  • Mobile Hotspot"
echo "  • Office Networks"
echo "  • Any WiFi without configuration!"
echo ""
echo "Just use: http://${HOSTNAME}.local:5000"
echo "No need to find IP addresses anymore!"
echo ""
