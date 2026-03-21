#!/bin/bash
# Test Autonomous Predator Detection System
# This simulates the system working offline (no app connected)

echo "🚨 TESTING AUTONOMOUS PREDATOR DETECTION SYSTEM"
echo "================================================"
echo ""
echo "This test verifies the system works independently of the React Native app."
echo ""

echo "📊 Current System Status:"
curl -s http://100.101.108.37:5000/status | python3 -m json.tool
echo ""

echo "🔍 Real-time Detection Monitoring:"
echo "Watching for predators... (Ctrl+C to stop)"
echo "Show a cat/dog/rat/snake to the camera for 10+ seconds to trigger valve!"
echo ""

# Monitor detections in real-time
while true; do
    RESPONSE=$(curl -s http://100.101.108.37:5000/detections)
    COUNT=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])")
    FPS=$(echo $RESPONSE | python3 -c "import sys, json; print(f\"{json.load(sys.stdin)['fps']:.1f}\")")

    if [ "$COUNT" -gt 0 ]; then
        echo "🚨 PREDATOR DETECTED! Count: $COUNT | FPS: $FPS"
        echo $RESPONSE | python3 -m json.tool
        echo ""
    else
        echo "🤖 System Active - Detection FPS: $FPS | Predators: $COUNT | $(date '+%H:%M:%S')"
    fi

    sleep 1
done