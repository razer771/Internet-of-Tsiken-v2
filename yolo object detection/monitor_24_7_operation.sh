#!/bin/bash
# Monitor 24/7 Operation - Track autonomous status and detection activity
# This tool provides real-time monitoring of autonomous predator detection

echo "🛡️  24/7 AUTONOMOUS PREDATOR DETECTION MONITOR"
echo "============================================="
echo ""
echo "📡 Real-time monitoring of autonomous operation"
echo "🎯 Tracking: AI status, predator detection, valve triggers"
echo "📱 App Independence: Shows activity even when mobile app closed"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo ""

# Function to show current autonomous status
show_status() {
    echo "📊 CURRENT AUTONOMOUS STATUS:"
    curl -s "http://100.101.108.37:5000/status" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'   🎥 Camera: {\"✅ Online\" if data[\"camera\"] else \"❌ Offline\"}')
    print(f'   🤖 AI Processing: {data[\"inference_fps\"]:.1f} FPS')
    print(f'   📹 Frame Capture: {data[\"producer_fps\"]:.1f} FPS')
    print(f'   ⚡ Model Loaded: {\"✅ Active\" if data[\"model\"] else \"❌ Failed\"}')
    print(f'   🌐 Status: {data[\"status\"].upper()}')
except:
    print('   ❌ Unable to get system status')
" 2>/dev/null

    echo ""
    echo "🔍 CURRENT DETECTIONS:"
    curl -s "http://100.101.108.37:5000/detections" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data['count'] > 0:
        print(f'   🚨 Active Objects: {data[\"count\"]}')
        for obj in data['objects']:
            print(f'      └─ {obj[\"class\"]}: {obj[\"confidence\"]}%')
    else:
        print('   ✅ No predators detected')
    print(f'   🧠 AI Performance: {data[\"fps\"]:.1f} FPS | {data[\"inference_time_ms\"]:.0f}ms')
    print(f'   📅 Last Update: {data[\"timestamp\"][-8:]}')
except:
    print('   ❌ Unable to get detection data')
" 2>/dev/null
    echo ""
}

# Show initial status
show_status

# Monitor logs in real-time
echo "🔄 LIVE AUTONOMOUS ACTIVITY LOG:"
echo "==============================="

# Follow logs and highlight important events
sudo journalctl -u camera-stream -f --since "now" | while read line; do
    timestamp=$(echo "$line" | cut -d' ' -f1-3)
    message=$(echo "$line" | cut -d' ' -f6-)

    # Skip HTTP request noise (keep only autonomous activity)
    if [[ "$message" == *"GET"*"HTTP"* ]]; then
        continue
    fi

    # Highlight different types of messages
    if [[ "$message" == *"AUTONOMOUS"* ]]; then
        echo "🤖 [$timestamp] $message"
    elif [[ "$message" == *"PREDATOR DETECTED"* ]]; then
        echo "🚨 [$timestamp] $message"
    elif [[ "$message" == *"VALVE TRIGGERED"* ]]; then
        echo "⚡ [$timestamp] $message"
    elif [[ "$message" == *"REPEAT VALVE"* ]]; then
        echo "🔄 [$timestamp] $message"
    elif [[ "$message" == *"detected - tracking"* ]]; then
        echo "🔍 [$timestamp] $message"
    elif [[ "$message" == *"tracking:"* ]]; then
        echo "⏱️  [$timestamp] $message"
    elif [[ "$message" == *"no longer detected"* ]]; then
        echo "✅ [$timestamp] $message"
    elif [[ "$message" == *"Arduino:"* ]]; then
        echo "🔧 [$timestamp] $message"
    elif [[ "$message" == *"ERROR"* ]] || [[ "$message" == *"WARN"* ]]; then
        echo "⚠️  [$timestamp] $message"
    else
        # Other system messages (startup, etc.)
        echo "📋 [$timestamp] $message"
    fi

    # Show status summary every 10 autonomous logs to track performance
    # (This gives a periodic update even when no predators are present)
done