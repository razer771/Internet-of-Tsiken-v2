# Quick Setup Script for WebRTC IoT Monitor (Windows)
# Run this script to complete the mobile app setup

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WebRTC IoT Monitor - Quick Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install Node dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install failed" -ForegroundColor Red
    exit 1
}

# Step 2: Prebuild for native modules
Write-Host ""
Write-Host "🔨 Prebuilding for react-native-webrtc..." -ForegroundColor Yellow
npx expo prebuild --clean

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Prebuild failed" -ForegroundColor Red
    exit 1
}

# Step 3: Build development client
Write-Host ""
Write-Host "📱 Ready to build development client for Android" -ForegroundColor Yellow
$build = Read-Host "Build now? (y/n)"

if ($build -eq "y" -or $build -eq "Y") {
    npx expo run:android
}

Write-Host ""
Write-Host "✅ Mobile app setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Configure RemoteIoTMonitorScreen.js endpoints (lines 47-48)" -ForegroundColor White
Write-Host "2. Setup Raspberry Pi (see docs/WEBRTC_IOT_DEPLOYMENT_GUIDE.md)" -ForegroundColor White
Write-Host "3. Navigate to 'RemoteMonitor' screen in your app" -ForegroundColor White
Write-Host ""
