# Expo Go vs Development Build - Which Should You Use?

## Quick Comparison

| Feature | **Expo Go** (HLS Version) | **Development Build** (WebRTC) |
|---------|---------------------------|--------------------------------|
| **Setup Time** | ✅ 0 minutes (instant) | ⚠️ 5-10 minutes (one-time) |
| **Native Modules** | ❌ No | ✅ Yes (full access) |
| **Video Latency** | ⚠️ 1-3 seconds | ✅ 100-300ms |
| **Bandwidth Usage** | ⚠️ Higher | ✅ Lower |
| **NAT Traversal** | ❌ No (local network only) | ✅ Yes (works anywhere) |
| **Code Updates** | ✅ Instant | ✅ Instant (after build) |
| **Production Ready** | ⚠️ Limited | ✅ Yes |

---

## Option 1: Expo Go Compatible (HLS Streaming)

### **What It Is**
Uses standard HTTP video streaming (HLS) instead of WebRTC. Works in Expo Go immediately.

### **Screen to Use**
```javascript
navigation.navigate('RemoteMonitorExpoGo');
```

**File:** `screens/User/RemoteIoTMonitorExpoGo.js`

### **MediaMTX Configuration**
Your existing `mediamtx.yml` already has HLS enabled. Just use this URL:
```javascript
HLS_STREAM_URL: 'http://192.168.1.100:8888/cam/index.m3u8'
```

### **Pros**
- ✅ **Zero setup** - Works in Expo Go immediately
- ✅ **Test instantly** - Scan QR code and run
- ✅ **Perfect for development** - Quick iteration
- ✅ **Still gets AI detections** via WebSocket

### **Cons**
- ❌ **Higher latency** - 1-3 second delay
- ❌ **Local network only** - Cannot work remotely without VPN
- ❌ **More bandwidth** - No peer-to-peer optimization
- ❌ **Not for production** - Professional apps need WebRTC

### **Best For:**
- 🔬 **Testing/Development**
- 🏠 **Local network use only**
- ⚡ **Quick prototypes**
- 👨‍💻 **Learning and experimentation**

---

## Option 2: Development Build (WebRTC)

### **What It Is**
Custom-built app with native WebRTC support. Works exactly like Expo Go but with your native modules.

### **Screen to Use**
```javascript
navigation.navigate('RemoteMonitor');
```

**File:** `screens/User/RemoteIoTMonitorScreen.js`

### **One-Time Setup**
```powershell
# Connect Android device or start emulator
npx expo run:android

# This will:
# 1. Run expo prebuild (creates android/ios folders)
# 2. Build APK with WebRTC
# 3. Install on device
# 4. Launch app

# Takes 5-10 minutes the first time
# After that, JS updates are instant!
```

### **Pros**
- ✅ **Professional quality** - 100-300ms latency
- ✅ **Works anywhere** - STUN servers for NAT traversal
- ✅ **Lower bandwidth** - Peer-to-peer when possible
- ✅ **Production ready** - Used by Zoom, Discord, etc.
- ✅ **Hardware accelerated** - Uses device video decoders
- ✅ **Still hot reloads** - Update JS code instantly

### **Cons**
- ⏱️ **Initial build time** - 5-10 minutes once
- 📱 **Need device/emulator** - Cannot use just QR code
- 💾 **Larger app size** - ~50MB vs Expo Go's generic size

### **Best For:**
- 🚀 **Production deployments**
- 🌍 **Remote access required**
- ⚡ **Low-latency critical**
- 📱 **Professional IoT monitoring**

---

## My Recommendation

### **For Now (Development Phase)**
👉 **Use Expo Go version** (`RemoteMonitorExpoGo`)

**Why:**
- Test immediately without waiting
- Iterate faster during development
- AI detection overlay still works perfectly
- Good enough to validate concept

**Configuration:**
```javascript
// screens/User/RemoteIoTMonitorExpoGo.js line 47
HLS_STREAM_URL: 'http://YOUR_PI_IP:8888/cam/index.m3u8'
WEBSOCKET_URL: 'ws://YOUR_PI_IP:8000/ws/alerts'
```

### **Before Production/Demo**
👉 **Build development client** (WebRTC version)

**Why:**
- Professional quality matters
- Remote access capability
- Better user experience
- One-time 10-minute build

**Command:**
```powershell
npx expo run:android
```

---

## Side-by-Side Code Difference

### Expo Go Version
```javascript
import { Video } from 'expo-av';

// Uses HLS
<Video
  source={{ uri: 'http://pi:8888/cam/index.m3u8' }}
  style={styles.video}
/>
```

### Development Build Version
```javascript
import { RTCView, RTCPeerConnection } from 'react-native-webrtc';

// Uses WebRTC WHEP
const pc = new RTCPeerConnection({ iceServers: [...] });
// ... WebRTC negotiation
<RTCView streamURL={stream.toURL()} style={styles.video} />
```

---

## Testing Instructions

### **Test Expo Go Version NOW**

1. **Make sure Expo is running:**
   ```powershell
   npx expo start
   ```

2. **Scan QR code with Expo Go app**

3. **Navigate to screen** (add this button somewhere):
   ```javascript
   <TouchableOpacity onPress={() => navigation.navigate('RemoteMonitorExpoGo')}>
     <Text>Open Camera (Expo Go)</Text>
   </TouchableOpacity>
   ```

4. **Configure Raspberry Pi IP** in `RemoteIoTMonitorExpoGo.js`

5. **Start MediaMTX** on Raspberry Pi (see deployment guide)

6. **Done!** You'll see video with ~1-2 second delay

---

## FAQ

**Q: Do I need to rebuild every time I change code?**
**A:** No! After the initial build, you get instant updates just like Expo Go.

**Q: Can I use both versions?**
**A:** Yes! Both screens are in your app. Use Expo Go version for testing, WebRTC for production.

**Q: How much time does building really take?**
**A:** First build: 5-10 minutes. Subsequent builds: 2-3 minutes. JS updates: instant.

**Q: Can I publish to Play Store with development build?**
**A:** No. For Play Store, use `eas build --platform android --profile production`

**Q: What if I don't have a Raspberry Pi yet?**
**A:** Use the Expo Go version with any public HLS stream URL to test the UI.

---

## Bottom Line

**Think of it like this:**

- **Expo Go** = Netflix on your smart TV (streaming, works immediately)
- **Development Build** = Video game (needs install, but better performance)

Both are useful! Start with Expo Go for convenience, upgrade to development build when you need professional quality.

---

## Quick Start Commands

```powershell
# Option 1: Test in Expo Go (RIGHT NOW)
npx expo start
# Scan QR → Navigate to RemoteMonitorExpoGo

# Option 2: Build once, use forever
npx expo run:android  # Takes 10 minutes
# Then: instant updates like Expo Go!
```

**You decide based on your timeline and needs.** Both are valid approaches! 🚀
