#!/bin/bash

# Camera Server Testing Script
# This script helps you verify the camera server is working correctly

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         CAMERA SERVER TESTING SUITE                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Check if process is running
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 1: Process Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if ps aux | grep -q "[s]tream_server.py"; then
    echo -e "${GREEN}✓ PASS${NC} - Camera server process is running"
    PID=$(ps aux | grep "[s]tream_server.py" | awk '{print $2}')
    echo "  Process ID: $PID"
else
    echo -e "${RED}✗ FAIL${NC} - Camera server process NOT running"
    echo "  Start it with: python stream_server.py"
    echo ""
    exit 1
fi
echo ""

# Test 2: Check if port 5000 is listening
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 2: Port Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if command -v netstat &> /dev/null; then
    if netstat -tuln | grep -q ":5000"; then
        echo -e "${GREEN}✓ PASS${NC} - Port 5000 is listening"
    else
        echo -e "${RED}✗ FAIL${NC} - Port 5000 is NOT listening"
    fi
elif command -v ss &> /dev/null; then
    if ss -tuln | grep -q ":5000"; then
        echo -e "${GREEN}✓ PASS${NC} - Port 5000 is listening"
    else
        echo -e "${RED}✗ FAIL${NC} - Port 5000 is NOT listening"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC} - Cannot check port (netstat/ss not available)"
fi
echo ""

# Test 3: HTTP Status Endpoint
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 3: HTTP /status Endpoint${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

STATUS_RESPONSE=$(curl -s -m 3 http://localhost:5000/status 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$STATUS_RESPONSE" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Server is responding to HTTP requests"
    echo "  Response:"
    echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
    
    # Check if status is "online"
    if echo "$STATUS_RESPONSE" | grep -q '"status".*:.*"online"'; then
        echo -e "${GREEN}✓ PASS${NC} - Server status is 'online'"
    else
        echo -e "${RED}✗ FAIL${NC} - Server status is NOT 'online'"
    fi
else
    echo -e "${RED}✗ FAIL${NC} - Server is NOT responding"
    echo "  Cannot connect to http://localhost:5000/status"
fi
echo ""

# Test 4: Camera Status Check
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 4: Camera Initialization${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if echo "$STATUS_RESPONSE" | grep -q '"camera".*:.*true'; then
    echo -e "${GREEN}✓ PASS${NC} - Camera is initialized"
else
    echo -e "${RED}✗ FAIL${NC} - Camera is NOT initialized"
fi
echo ""

# Test 5: YOLO Model Status
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 5: YOLO Model${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if echo "$STATUS_RESPONSE" | grep -q '"model".*:.*true'; then
    echo -e "${GREEN}✓ PASS${NC} - YOLO model is loaded"
else
    echo -e "${RED}✗ FAIL${NC} - YOLO model is NOT loaded"
fi
echo ""

# Test 6: Detection Endpoint
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 6: /detections Endpoint${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

DETECTION_RESPONSE=$(curl -s -m 3 http://localhost:5000/detections 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$DETECTION_RESPONSE" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Detection endpoint is responding"
    echo "  Response:"
    echo "$DETECTION_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DETECTION_RESPONSE"
    
    # Check FPS
    FPS=$(echo "$DETECTION_RESPONSE" | grep -o '"fps"[[:space:]]*:[[:space:]]*[0-9.]*' | grep -o '[0-9.]*$')
    if [ -n "$FPS" ] && (( $(echo "$FPS > 0" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "${GREEN}✓ PASS${NC} - Camera is processing frames (FPS: $FPS)"
    else
        echo -e "${YELLOW}⊘ WARN${NC} - FPS is 0 or not detected (camera may be starting up)"
    fi
else
    echo -e "${RED}✗ FAIL${NC} - Detection endpoint is NOT responding"
fi
echo ""

# Test 7: Network Accessibility
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 7: Network Accessibility${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "  Local IP: $LOCAL_IP"

# Test via IP
IP_RESPONSE=$(curl -s -m 3 http://$LOCAL_IP:5000/status 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$IP_RESPONSE" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Accessible via IP: http://$LOCAL_IP:5000"
else
    echo -e "${RED}✗ FAIL${NC} - NOT accessible via IP"
fi

# Test via hostname
HOSTNAME=$(hostname)
HOSTNAME_RESPONSE=$(curl -s -m 3 http://$HOSTNAME.local:5000/status 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$HOSTNAME_RESPONSE" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Accessible via hostname: http://$HOSTNAME.local:5000"
else
    echo -e "${YELLOW}⊘ WARN${NC} - NOT accessible via hostname (mDNS may not be configured)"
    echo "  This is OK if using IP address instead"
fi
echo ""

# Test 8: Video Feed Endpoint
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST 8: /video_feed Endpoint${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Just check if endpoint responds (don't download the whole stream)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 2 http://localhost:5000/video_feed 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Video feed endpoint is streaming (HTTP 200)"
else
    echo -e "${RED}✗ FAIL${NC} - Video feed endpoint is NOT working (HTTP $HTTP_CODE)"
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}SUMMARY & NEXT STEPS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📱 To test from your mobile app:"
echo ""
echo "   1. Make sure your phone is on the same WiFi network"
echo "   2. Open the app on your phone"
echo "   3. Navigate to Control Screen or Camera Stream"
echo "   4. Click 'Detect Camera' button"
echo ""
echo "🌐 Access URLs for your app:"
echo ""
echo "   IP Address:  http://$LOCAL_IP:5000"
echo "   Hostname:    http://$HOSTNAME.local:5000"
echo ""
echo "🔍 View live stream in browser:"
echo ""
echo "   http://localhost:5000/video_feed"
echo "   http://$LOCAL_IP:5000/video_feed"
echo ""
echo "📊 View detection data:"
echo ""
echo "   curl http://localhost:5000/detections"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
