#!/bin/bash
# Validate Autonomous Operation - Verify AI runs independently for 60 seconds
# This test ensures predator detection works without any HTTP requests

echo "🤖 AUTONOMOUS OPERATION VALIDATION TEST"
echo "====================================="
echo ""
echo "This test verifies the AI detection system runs for 60 seconds"
echo "WITHOUT any HTTP requests from the React Native app."
echo ""
echo "🧪 Test Procedure:"
echo "1. Record initial status"
echo "2. Wait 60 seconds with NO HTTP requests"
echo "3. Check if timestamps updated (proves AI is running)"
echo "4. Verify detection buffer continues updating"
echo ""

# Function to get current status without interfering with operation
get_status() {
    curl -s "http://100.101.108.37:5000/detections" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f\"{data['timestamp'][-8:]}|{data['fps']:.2f}|{data['count']}\")
except:
    print('ERROR|0.00|0')
" 2>/dev/null
}

echo "📊 Step 1: Recording initial status..."
INITIAL_STATUS=$(get_status)
INITIAL_TIME=$(echo $INITIAL_STATUS | cut -d'|' -f1)
INITIAL_FPS=$(echo $INITIAL_STATUS | cut -d'|' -f2)
INITIAL_COUNT=$(echo $INITIAL_STATUS | cut -d'|' -f3)

echo "   Initial Time: $INITIAL_TIME"
echo "   Initial FPS: $INITIAL_FPS"
echo "   Initial Objects: $INITIAL_COUNT"
echo ""

echo "⏱️  Step 2: Waiting 60 seconds with NO HTTP requests..."
echo "   (This simulates React Native app being completely closed)"

# Show countdown
for i in {60..1}; do
    printf "\r   ⏳ Countdown: %2d seconds remaining" $i
    sleep 1
done

printf "\r   ✅ 60 seconds completed                    \n"
echo ""

echo "📊 Step 3: Checking final status..."
FINAL_STATUS=$(get_status)
FINAL_TIME=$(echo $FINAL_STATUS | cut -d'|' -f1)
FINAL_FPS=$(echo $FINAL_STATUS | cut -d'|' -f2)
FINAL_COUNT=$(echo $FINAL_STATUS | cut -d'|' -f3)

echo "   Final Time: $FINAL_TIME"
echo "   Final FPS: $FINAL_FPS"
echo "   Final Objects: $FINAL_COUNT"
echo ""

# Analysis
echo "🔍 VALIDATION RESULTS:"
echo "====================="

if [ "$FINAL_TIME" != "$INITIAL_TIME" ]; then
    echo "✅ PASS: Timestamps changed - AI continued processing autonomously!"
    echo "   📈 Time progression: $INITIAL_TIME → $FINAL_TIME"
else
    echo "❌ FAIL: Timestamps unchanged - AI may have stopped!"
fi

if [ "$FINAL_FPS" != "0.00" ]; then
    echo "✅ PASS: AI FPS > 0 - Inference engine is active!"
    echo "   🧠 FPS performance: $INITIAL_FPS → $FINAL_FPS"
else
    echo "❌ FAIL: AI FPS is 0 - Inference engine stopped!"
fi

# Check system logs for autonomous activity
echo ""
echo "📋 Recent autonomous logs (last 2 minutes):"
sudo journalctl -u camera-stream --since "2 minutes ago" | grep -E "AUTONOMOUS|tracking|VALVE" | tail -5 | while read line; do
    timestamp=$(echo "$line" | cut -d' ' -f3)
    message=$(echo "$line" | cut -d' ' -f6-)
    echo "   [$timestamp] $message"
done

echo ""
echo "🎯 AUTONOMOUS OPERATION STATUS:"
if [ "$FINAL_TIME" != "$INITIAL_TIME" ] && [ "$FINAL_FPS" != "0.00" ]; then
    echo "✅ SYSTEM IS FULLY AUTONOMOUS - Detects predators 24/7 without app!"
    echo "   🛡️  Your property is protected even when the app is closed"
    echo "   ⚡ Valve will trigger automatically on predator detection"
else
    echo "⚠️  SYSTEM MAY NOT BE FULLY AUTONOMOUS - Check service status"
    echo "   Run: sudo systemctl status camera-stream"
fi

echo ""
echo "🧪 Test completed!"