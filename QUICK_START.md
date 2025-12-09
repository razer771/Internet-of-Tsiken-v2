# 🚀 Quick Start Guide - Predator Detection Feature

## ⚡ 5-Minute Setup

### Step 1: Add Navigation (2 minutes)

Find your main navigation file (usually `App.js`) and add these imports:

```javascript
import PredatorDetectionsList from "./screens/User/PredatorDetections/PredatorDetectionsList";
import PredatorDetectionDetail from "./screens/User/PredatorDetections/PredatorDetectionDetail";
```

Add these screens to your Stack.Navigator:

```javascript
<Stack.Screen
  name="PredatorDetectionsList"
  component={PredatorDetectionsList}
  options={{ headerShown: false }}
/>

<Stack.Screen
  name="PredatorDetectionDetail"
  component={PredatorDetectionDetail}
  options={{ headerShown: false }}
/>
```

### Step 2: Add Access Button (1 minute)

Add a button in your Dashboard or Controls screen:

```javascript
<TouchableOpacity
  style={styles.button}
  onPress={() => navigation.navigate("PredatorDetectionsList")}
>
  <Icon name="shield-alert" size={24} color="#FF6B6B" />
  <Text style={styles.buttonText}>View Predator Detections</Text>
</TouchableOpacity>
```

### Step 3: Test It! (2 minutes)

1. **Open Camera Stream** in your app
2. **Point camera** at a cat, dog, or bird
3. **Wait** for auto-capture (≥80% confidence)
4. **Check notification** that appears
5. **Navigate** to Predator Detections List
6. **View** your captured detection!

---

## ✅ That's It!

The feature is fully functional. Everything else is already implemented:

- ✅ Firebase Storage configured
- ✅ Capture service ready
- ✅ Auto-capture enabled by default
- ✅ Manual capture button added
- ✅ Detections list screen ready
- ✅ Detail view ready
- ✅ Activity logs integrated
- ✅ Notifications working

---

## 🎯 Quick Test Checklist

- [ ] Added navigation routes
- [ ] Added access button
- [ ] App builds without errors
- [ ] Can open camera stream
- [ ] Auto-capture toggle visible
- [ ] "Capture Now" button visible
- [ ] Can navigate to detections list
- [ ] Detections appear after capture
- [ ] Can view detection details
- [ ] Can update status
- [ ] Can delete detection

---

## 📱 How Users Will Use It

### Automatic Mode (Recommended)

1. Open camera stream
2. Leave "Auto-capture predators" enabled
3. System monitors automatically
4. Get notified when predators detected
5. Review captures in Detections List

### Manual Mode

1. Open camera stream
2. Watch live feed
3. Click "Capture Now" when you see a predator
4. Immediate capture and notification
5. Review in Detections List

---

## 🔧 Common Customizations

### Change Auto-Capture Confidence

File: `modules/CameraStream.js` (line ~55)

```javascript
const predator = checkForPredators(detections, 70); // Change from 80 to 70
```

### Change Cooldown Period

File: `modules/CameraStream.js` (line ~60)

```javascript
if (now - lastCaptureRef.current < 5000) // Change from 10000 to 5000 (5 seconds)
```

### Disable Auto-Capture by Default

File: `modules/CameraStream.js` (line ~24)

```javascript
const [autoCapture, setAutoCapture] = useState(false); // Change from true to false
```

### Add/Remove Predator Classes

File: `modules/PredatorDetectionService.js` (line ~10)

```javascript
const PREDATOR_CLASSES = [
  "cat",
  "dog",
  "bird",
  "bear",
  "mouse",
  // Add new classes here
];
```

---

## 🆘 Troubleshooting

### "Navigation.navigate is not a function"

→ Make sure you added the routes to your Stack.Navigator

### "Cannot find module PredatorDetectionsList"

→ Check the import path matches your folder structure

### Detections not appearing in list

→ Verify Firebase Storage is enabled in Firebase Console
→ Check user is logged in (auth.currentUser)

### Auto-capture not working

→ Verify toggle is enabled (should be on by default)
→ Check if 10-second cooldown is active
→ Ensure predator confidence is ≥80%

---

## 📚 Full Documentation

For complete technical details, see:

- `IMPLEMENTATION_COMPLETE.md` - Full feature summary
- `PREDATOR_DETECTION_SETUP.md` - Detailed setup guide
- `predator_detection/TECHNICAL_DOCS.md` - Technical reference
- `predator_detection/ARCHITECTURE_DIAGRAM.md` - Visual diagrams

---

## 🎉 You're Ready!

Start your app and test the predator detection feature. Happy hunting! 🐾
