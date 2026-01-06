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

### Start Camera Server (Local Network Only)

The camera server runs on the same network for fast, low-latency streaming with YOLO object detection.

```bash
cd ~/Internet-of-Tsiken-v2/"yolo object detection" && ./start_camera.sh
```

**Access URLs:**
- Local IP: `http://192.168.68.134:5000` (changes based on your network)
- Hostname: `http://rpi5desktop.local:5000` (works across all networks)

### Check Server Status

```bash
curl -s http://localhost:5000/status
```

### How It Works

1. Start the camera server using the command above
2. Open the app and navigate to **Control Screen**
3. Click **"Detect Camera"** button
4. The app will automatically find the camera server on your network
5. Live stream with YOLO detection will appear

**Note:** Make sure your phone and Raspberry Pi are on the same WiFi network for best performance.