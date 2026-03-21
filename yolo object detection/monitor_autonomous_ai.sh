#!/bin/bash
# Monitor ONLY autonomous AI activity (no HTTP request noise)

echo "🤖 MONITORING AUTONOMOUS AI ACTIVITY"
echo "===================================="
echo "This shows ONLY the AI inference and detection activity"
echo "Filtering out HTTP request logs from the React Native app"
echo ""
echo "Close your app completely and watch - AI will still run!"
echo "Press Ctrl+C to stop"
echo ""

sudo journalctl -u camera-stream -f | grep -E "(INFERENCE|PREDATOR|VALVE|tracking|detected|DOG|CAT|RAT|SNAKE|AUTONOMOUS)" | grep -v "GET.*HTTP"