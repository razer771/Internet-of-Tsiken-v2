# Login Navigation Loop Fix

## Problem Summary

After successful login, users were stuck on the Login screen instead of being navigated to Home/AdminDashboard. This was caused by a race condition between:

- `LogIn.js` calling `navigation.reset()` to navigate to the destination screen
- `App.js` auth listener (`onAuthStateChanged`) updating state and potentially re-initializing the Stack.Navigator

## Root Cause

The auth listener in `App.js` was checking the `loginInProgress` flag but **only using it to skip navigation logic**. However, it was still executing the rest of the function, which included:

- Fetching user data from Firestore
- Updating `setIsAuthenticated(true)`
- Updating `setInitialRoute("Home"/"AdminDashboard")`
- Updating `setAuthLoading(false)`

When `initialRoute` state changed during the login flow, it caused `Stack.Navigator` to re-initialize with a new `initialRouteName`, creating a conflict with the `navigation.reset()` call from `LogIn.js`.

## Solution Implemented

### App.js Changes

**File:** `App.js`

**Changed 1:** Moved the `loginInProgress` check to the **very beginning** of the auth listener, before any user state is checked.

**Changed 2:** Reset `hasInitializedRef` when user signs out to allow proper re-initialization on next login.

```javascript
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    // CRITICAL: Check if we're in the middle of a login flow FIRST
    // Exit early to prevent ANY state updates that could interfere
    const isLoginInProgress = await AsyncStorage.getItem("loginInProgress");
    if (isLoginInProgress === "true") {
      console.log("⏸️ Login in progress - App.js skipping ALL auth handling");
      return; // EXIT IMMEDIATELY - no state changes
    }

    const isAccountCreationInProgress = await AsyncStorage.getItem(
      "accountCreationInProgress"
    );
    if (isAccountCreationInProgress === "true") {
      console.log(
        "⏸️ Account creation in progress - App.js skipping ALL auth handling"
      );
      return; // EXIT IMMEDIATELY - no state changes
    }

    // Now process auth state normally...
    if (user) {
      // Fetch user data and update initialRoute
    }
  });
}, []);
```

**Key Changes:**

1. **Early return:** Flag check happens BEFORE checking `if (user)`
2. **No state updates:** When flag is set, the function exits immediately
3. **Prevents re-initialization:** Stack.Navigator's `initialRouteName` won't change during login
4. **Reset on logout:** `hasInitializedRef` is reset to `false` when user signs out
5. **Conditional initialization:** Only mark as initialized when user is authenticated

### LogIn.js (Already Correct)

**File:** `screens/LogIn/LogIn.js`

The login flow already implements proper flag management:

```javascript
// 1. Set flag before authentication (line 264)
await AsyncStorage.setItem("loginInProgress", "true");

// 2. Authenticate with Firebase
const userCredential = await signInWithEmailAndPassword(
  auth,
  email.trim(),
  password
);

// 3. Fetch user data from Firestore and determine destination

// 4. Navigate with stack reset (lines 361-363, 399-401, 413-415)
navigation.reset({
  index: 0,
  routes: [{ name: "AdminDashboard" }], // or "Home" for users
});

// 5. Clear flag AFTER navigation with delay (lines 366-369, 402-405, 420-423)
setTimeout(async () => {
  await AsyncStorage.removeItem("loginInProgress");
}, 500);
```

**Why 500ms delay?**

- Allows `navigation.reset()` to complete before App.js can react
- Prevents App.js from triggering during the navigation transition
- After 500ms, App.js is allowed to handle auth state changes normally

## How It Works

### Sequence During Login:

1. **User clicks Login button**
   - `loginInProgress = "true"` is set in AsyncStorage

2. **Firebase Authentication**
   - `signInWithEmailAndPassword()` succeeds
   - Firebase triggers `onAuthStateChanged` listener

3. **App.js Auth Listener Fires**
   - Checks `loginInProgress` flag → finds "true"
   - **EXITS IMMEDIATELY** without any state changes
   - Stack.Navigator remains stable

4. **LogIn.js Continues**
   - Fetches user data from Firestore
   - Determines destination (AdminDashboard/Home/VerifyIdentity)
   - Calls `navigation.reset()` to navigate
   - Navigation completes successfully

5. **500ms Later**
   - `loginInProgress` flag is cleared
   - App.js can now handle future auth changes normally

### Sequence During Logout and Re-Login:

1. **User clicks Logout**
   - Firebase `signOut()` is called
   - `onAuthStateChanged` listener fires with `user = null`

2. **App.js Auth Listener (Logout)**
   - Detects `user === null`
   - **Resets** `hasInitializedRef.current = false`
   - **Resets** `hasInitialized` state = false
   - Sets `initialRoute = "LogIn"`
   - Shows login screen

3. **User Logs In Again**
   - `loginInProgress = "true"` is set
   - Firebase authentication succeeds
   - Auth listener fires but **exits early** (sees loginInProgress)
   - LogIn.js navigates to Home/AdminDashboard
   - Flag cleared after 500ms

4. **Next Auth Listener (After Login)**
   - `hasInitializedRef.current` was reset to `false` during logout
   - Updates `initialRoute` to "Home"/"AdminDashboard"
   - Sets `hasInitializedRef.current = true`
   - Navigation works correctly

### Sequence During App Restart (with existing session):

1. **App.js Auth Listener Fires**
   - Checks `loginInProgress` → not set (returns null)
   - Continues to fetch user data
   - Updates `initialRoute` to "Home"/"AdminDashboard"
   - Stack.Navigator initializes with correct screen

2. **User sees their dashboard immediately**

## Testing Instructions

### Test Case 1: Fresh Login

1. Make sure you're logged out
2. Enter valid credentials (user or admin)
3. Click "Login"
4. **Expected:** Should navigate directly to Home (user) or AdminDashboard (admin)
5. **Check logs:** Should see:
   ```
   ⏸️ Login in progress - App.js skipping ALL auth handling
   🔀 Navigating to Home/AdminDashboard NOW
   ```

### Test Case 2: Unverified User

1. Login with unverified account
2. **Expected:** Navigate to VerifyIdentity screen
3. **Check:** No navigation loop

### Test Case 3: App Restart with Active Session

1. Login successfully
2. Close and restart the app (or refresh in dev)
3. **Expected:** App should load directly to Home/AdminDashboard
4. **Check logs:** Should see:
   ```
   👤 [App.js] Active User → Setting initialRoute: Home
   ```

### Test Case 4: Multiple Account Types

1. Test with admin account → AdminDashboard
2. Logout
3. Test with user account → Home
4. **Expected:** Both should navigate correctly without loops

### Test Case 5: Admin Bypass

1. Login with `admin@example.com` / `admin1234`
2. **Expected:** Navigate to AdminDashboard
3. **Check:** Works with bypass logic

## Console Log Reference

### During Login (Expected Logs):

```
🔔 Auth listener fired - hasInitialized: false
⏸️ Login in progress - App.js skipping ALL auth handling
✅ Verified + Active + User → Home
🔀 Navigating to Home NOW
```

### During Logout (Expected Logs):

```
🔔 Auth listener fired - hasInitialized: true
🔓 Auth state changed: User signed out
🔄 Resetting hasInitializedRef for fresh login flow
```

### During Re-Login After Logout (Expected Logs):

```
🔔 Auth listener fired - hasInitializedRef: false
⏸️ Login in progress - App.js skipping ALL auth handling
✅ Verified + Active + User → Home
🔀 Navigating to Home NOW
```

```
🔔 Auth listener fired - hasInitialized: false
🔐 Auth state changed: User authenticated <uid>
👤 [App.js] Active User → Setting initialRoute: Home
```

### What NOT to See:

```
❌ [App] Mounted (twice in a row)
❌ ✅ App already initialized - skipping... (during fresh login)
❌ Any navigation.reset loops
```

## Emergency Rollback

If this fix causes issues, you can rollback by restoring the previous auth listener logic in `App.js`:

```javascript
// OLD VERSION (before fix):
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      const isLoginInProgress = await AsyncStorage.getItem("loginInProgress");
      if (isLoginInProgress === "true") {
        return;
      }
      // ... rest of logic
    }
  });
}, []);
```

However, this will bring back the navigation loop issue.

## Related Files

- `App.js` - Auth listener with early flag check
- `screens/LogIn/LogIn.js` - Login flow with flag management
- `screens/LogIn/verifyIdentity.js` - OTP verification (also clears flag)

## Additional Notes

### Why hasInitializedRef?

The `hasInitializedRef` was added to prevent `initialRoute` updates after the first auth check completes. This prevents the Stack.Navigator from re-initializing when the auth state changes (e.g., when user data is updated in Firestore).

### Why Not Remove onAuthStateChanged?

The auth listener is still needed for:

- Detecting when user logs out
- Handling app restart with existing session
- Detecting when user is signed out externally (e.g., from another device)

The fix ensures it doesn't interfere during the login flow, but it remains active for all other auth state changes.

---

**Last Updated:** December 6, 2024  
**Status:** ✅ IMPLEMENTED - Ready for Testing
