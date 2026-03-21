#!/bin/bash
# Test the new aggressive valve behavior

echo "🚨 TESTING AGGRESSIVE VALVE SYSTEM"
echo "=================================="
echo ""
echo "📋 New Behavior:"
echo "1️⃣ Show cat/dog for 10+ seconds → First valve trigger"
echo "2️⃣ Keep showing it → Every 3 seconds → Valve triggers again!"
echo "3️⃣ Remove predator → 120 second cooldown starts"
echo ""
echo "🔍 Monitoring valve triggers... (Ctrl+C to stop)"
echo ""

# Monitor for valve activity and tracking
sudo journalctl -u camera-stream -f | grep -E "(tracking|VALVE|TRIGGER|REPEAT|detected)" | while read line; do
    timestamp=$(echo "$line" | cut -d' ' -f3)
    message=$(echo "$line" | cut -d' ' -f6-)

    echo "[$timestamp] $message"

    # Highlight valve triggers
    if [[ "$message" == *"VALVE TRIGGERED"* ]]; then
        echo "            🚨🚨🚨 VALVE ACTIVATED! 🚨🚨🚨"
    elif [[ "$message" == *"REPEAT VALVE"* ]]; then
        echo "            🔄🔄🔄 AGGRESSIVE REPEAT! 🔄🔄🔄"
    fi
done