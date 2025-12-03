# Internet-of-Tsiken-v2

A chicken monitoring application mainly used to observe the brooder, the environment outside the brooder, the temperature and also the behavior of the chickens inside the brooder.

## ⚠️ DISCLAIMER
This is a new repository, please discard the old version. Thank You.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your machine:

- **Node.js**: v18.x or higher (Recommended: v20.x or v22.x)
  - Current working version: `v24.1.0`
  - Check version: `node --version`
- **npm**: v9.x or higher
  - Current working version: `v11.5.2`
  - Check version: `npm --version`
- **Git**: For version control
- **Expo Go App** (for mobile testing):
  - [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
  - [iOS](https://apps.apple.com/app/expo-go/id982107779)

### Recommended: Use Node Version Manager

To avoid version conflicts, consider using a Node version manager:
- **Windows**: [nvm-windows](https://github.com/coreybutler/nvm-windows)
- **macOS/Linux**: [nvm](https://github.com/nvm-sh/nvm)

```bash
# Example: Install and use Node v22
nvm install 22
nvm use 22
```

---

## 🚀 Installation

Follow these steps to set up the project on your local machine:

### 1. Clone the Repository

```bash
git clone https://github.com/razer771/Internet-of-Tsiken-v2.git
cd Internet-of-Tsiken-v2
```

### 2. Install Dependencies

Use `npm ci` for exact version matching (recommended for teams):

```bash
npm ci
```

Or use `npm install` if you don't have `package-lock.json`:

```bash
npm install
```

**Important**: This will install all dependencies with the exact versions specified in `package-lock.json`, ensuring consistency across all team members.

### 3. Set Up Firebase Configuration

The Firebase configuration file is gitignored for security. You need to create your own:

#### Option A: Use the Template File

```bash
# Copy the example file
copy config\firebaseconfig.example.js config\firebaseconfig.js
```

Then edit `config/firebaseconfig.js` and replace the placeholder values with your actual Firebase credentials.

#### Option B: Get Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select the **internet-of-tsiken** project (or create a new one)
3. Navigate to **Project Settings** > **Your apps** > **SDK setup and configuration**
4. Copy your Firebase configuration object
5. Create `config/firebaseconfig.js` and paste your credentials:

```javascript
// config/firebaseconfig.js
import { initializeApp } from "firebase/app";
import { 
  initializeAuth, 
  getReactNativePersistence 
} from 'firebase/auth'; 
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);

let analytics;
(async () => {
  if (await isSupported()) {
    try {
      analytics = getAnalytics(app);
    } catch (e) {
      console.log("Failed to initialize Analytics", e);
    }
  }
})();

export { analytics };
export default app;
```

**⚠️ Never commit `config/firebaseconfig.js` to git!** It's already in `.gitignore`.

---

## 🏃 Running the App

### Start the Development Server

```bash
npm start
```

This will start the Expo development server. You'll see a QR code in the terminal.

### Run on Specific Platforms

**Android:**
```bash
npm run android
```

**iOS (macOS only):**
```bash
npm run ios
```

**Web Browser:**
```bash
npm run web
```

### Testing on Physical Device

1. Install **Expo Go** app on your phone
2. Run `npm start`
3. Scan the QR code with:
   - **Android**: Expo Go app
   - **iOS**: Camera app (will open in Expo Go)

---

## 📦 Project Dependencies

### Core Dependencies (from package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~54.0.23 | React Native framework |
| `react` | 19.1.0 | UI library |
| `react-native` | 0.81.5 | Mobile app framework |
| `firebase` | ^12.5.0 | Backend services |
| `@react-navigation/native` | ^7.1.19 | Navigation |
| `lottie-react-native` | ~7.3.1 | Animations |
| `expo-av` | ~16.0.7 | Audio/Video playback |

**Full list**: See `package.json`

---

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### 1. **"Module not found" or dependency errors**

```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

#### 2. **Expo/Metro bundler issues**

```bash
# Clear Expo cache
npx expo start --clear
```

#### 3. **Node version mismatch**

Ensure you're using Node v18 or higher. Check with:
```bash
node --version
```

Switch to a compatible version using `nvm`:
```bash
nvm use 22
```

#### 4. **Firebase configuration errors**

- Ensure `config/firebaseconfig.js` exists and has valid credentials
- Check that the Firebase project is active in Firebase Console
- Verify all Firebase services (Auth, Firestore, Analytics) are enabled

#### 5. **Android/iOS build failures**

```bash
# For Android
cd android
./gradlew clean
cd ..

# Rebuild
npx expo run:android
```

#### 6. **"Unable to resolve module" error**

```bash
# Reset Metro bundler cache
npx expo start --clear

# Or restart with cache clear
npm start -- --reset-cache
```

---

## 👥 Team Collaboration

### For New Team Members

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Install exact dependencies:**
   ```bash
   npm ci
   ```

3. **Set up your Firebase config:**
   ```bash
   copy config\firebaseconfig.example.js config\firebaseconfig.js
   ```
   Then add your credentials.

4. **Start development:**
   ```bash
   npm start
   ```

### Important Notes

- **Always use `npm ci`** instead of `npm install` to ensure everyone has the same dependency versions
- **Never commit `config/firebaseconfig.js`** - it contains sensitive API keys
- **Keep `package-lock.json` in version control** - this ensures version consistency
- **Update README** if you add new dependencies or change the setup process

---

## 📞 Support

If you encounter issues not covered in this README, please:
1. Check existing GitHub Issues
2. Create a new issue with detailed error messages
3. Contact the team lead

---

## 📄 License

0BSD

---

## 📷 Camera Server (YOLO Object Detection)

The camera server runs on your Raspberry Pi and streams live video with AI object detection to your mobile app.

---

### 🔧 Development vs Production Setup

| Mode | When to Use | How to Start Camera |
|------|-------------|---------------------|
| **Development** | Testing with Expo Go | Run manually each time |
| **Production** | APK installed on phone | Auto-starts on Pi boot |

---

## 📋 Complete Deployment Guide

### **PHASE 1: Development & Testing** (What you're doing now)

#### 1. Start Camera Server Manually

While developing and testing with Expo Go, start the camera server manually:

```bash
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
python stream_server.py
```

Or use the convenience script:

```bash
cd ~/Internet-of-Tsiken-v2/"yolo object detection" && ./start_camera.sh
```

#### 2. Test the Mobile App

```bash
# In your project root
npm start
```

- Scan QR code with Expo Go
- Navigate to Control Screen
- Click "Detect Camera" button
- Camera should auto-connect

#### 3. Stop Camera Server When Done

```bash
# Press Ctrl+C in the terminal running the server
# Or kill the process
pkill -f stream_server.py
```

---

### **PHASE 2: Production Deployment** (For APK usage)

When you're ready to build an APK and deploy for real use, follow these steps:

#### Step 1: Install Camera Server as Auto-Start Service

On your Raspberry Pi, run this **ONE TIME** setup:

```bash
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
chmod +x install_service.sh
./install_service.sh
```

This will:
- ✅ Install camera server as a systemd service
- ✅ Configure auto-start on boot
- ✅ Enable auto-restart if it crashes
- ✅ Start the service immediately

**After this, you NEVER need to manually start the camera server again!** It will:
- Start automatically when Raspberry Pi boots
- Keep running in the background 24/7
- Restart automatically if it crashes
- Persist across reboots

#### Step 2: Verify Auto-Start is Working

```bash
# Check service status
sudo systemctl status yolo-camera

# View live logs
sudo journalctl -u yolo-camera -f

# Test the server is responding
curl http://localhost:5000/status
```

#### Step 3: Build Your APK

```bash
# In your project root
eas build --platform android --profile preview
```

#### Step 4: Install APK on Phone

1. Download the APK from the build link
2. Install on your Android phone
3. Open the app
4. Navigate to Control Screen
5. Click "Detect Camera" - it will auto-connect to your Pi

**The camera server is now running 24/7 automatically!**

---

### 🛠️ Service Management Commands

Once installed as a service, use these commands:

```bash
# Check if service is running
sudo systemctl status yolo-camera

# Stop the service
sudo systemctl stop yolo-camera

# Start the service
sudo systemctl start yolo-camera

# Restart the service
sudo systemctl restart yolo-camera

# View real-time logs
sudo journalctl -u yolo-camera -f

# Disable auto-start (but keep installed)
sudo systemctl disable yolo-camera

# Re-enable auto-start
sudo systemctl enable yolo-camera

# Completely uninstall the service
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
./uninstall_service.sh
```

---

### 🔄 The Complete Flow

```
┌─────────────────────────────────────────────────────────┐
│              DEVELOPMENT (Testing)                      │
├─────────────────────────────────────────────────────────┤
│ 1. You: python stream_server.py (manual start)         │
│ 2. You: npm start (Expo Go)                             │
│ 3. Test on phone with Expo Go app                       │
│ 4. You: Ctrl+C to stop server when done                │
└─────────────────────────────────────────────────────────┘
                          ↓
                  When ready for production
                          ↓
┌─────────────────────────────────────────────────────────┐
│              PRODUCTION (APK)                           │
├─────────────────────────────────────────────────────────┤
│ 1. You: ./install_service.sh (ONE TIME ONLY)           │
│    → Camera server now auto-starts on boot             │
│ 2. You: eas build --platform android                   │
│ 3. You: Install APK on phone                            │
│ 4. User: Opens app anytime                              │
│    → Camera automatically connects (Pi always running)  │
│ 5. Camera server: Runs 24/7, restarts if crashes       │
└─────────────────────────────────────────────────────────┘
```

---

### 📊 Quick Reference

**Access URLs:**
- Local IP: `http://192.168.68.134:5000` (changes per network)
- Hostname: `http://rpi5desktop.local:5000` (recommended - works everywhere)

**Health Check:**
```bash
curl -s http://localhost:5000/status
```

**View What's Being Detected:**
```bash
curl -s http://localhost:5000/detections
```

---

### ⚠️ Important Notes

1. **Development Mode**: Manually start/stop camera server as needed
2. **Production Mode**: Install service ONCE, then forget about it
3. **The APK doesn't run the camera** - the Raspberry Pi does
4. **The APK only connects** to the already-running camera server
5. **Network requirement**: Phone and Pi must be on same WiFi/network
6. **Auto-discovery**: App automatically finds the Pi (no IP entry needed)

---

### 🐛 Troubleshooting Production Deployment

**Camera not connecting in APK:**

```bash
# 1. Check if service is running
sudo systemctl status yolo-camera

# 2. Check if server is responding
curl http://localhost:5000/status

# 3. Restart the service
sudo systemctl restart yolo-camera

# 4. Check logs for errors
sudo journalctl -u yolo-camera -n 50
```

**Service won't start:**

```bash
# Check for errors
sudo journalctl -u yolo-camera -n 100

# Common fixes:
# - Make sure Python dependencies are installed
cd ~/Internet-of-Tsiken-v2/"yolo object detection"
pip install -r requirements.txt

# - Reinstall the service
./uninstall_service.sh
./install_service.sh
```

**Need to go back to manual control:**

```bash
# Temporarily disable auto-start
sudo systemctl stop yolo-camera
sudo systemctl disable yolo-camera

# Now you can run manually
python stream_server.py
```

## temporarily stop the camera server
pkill -f stream_server.py