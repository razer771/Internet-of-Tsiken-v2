import "react-native-gesture-handler";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Modal,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { navigationRef } from "./services/NavigationService";
import * as SplashScreen from "expo-splash-screen";
import { NotificationProvider } from "./screens/User/controls/NotificationContext";
import { auth, db } from "./config/firebaseconfig";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

// Keep the splash screen visible while we fetch resources
try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.warn("SplashScreen error:", e);
}

// Components
import JsonSplashScreen from "./JsonSplashScreen/JsonSplashScreen";
import LogIn from "./screens/LogIn/LogIn";
import LoginSuccess from "./screens/LogIn/loginSuccess";
import VerifyIdentity from "./screens/LogIn/verifyIdentity";
import PasswordUpdated from "./screens/LogIn/passwordupdated";
import ResetPassword from "./screens/LogIn/resetpassword";
import MobileNumberInput from "./screens/LogIn/MobileNumberInput";
import OTPVerification from "./screens/LogIn/OTPVerification";
import ConfirmPassword from "./screens/LogIn/ConfirmPassword";
import CreateNewPassword from "./screens/LogIn/CreateNewPassword";

import Home from "./screens/User/Dashboard/Home";
import Notification from "./screens/User/controls/Notification";
import ControlScreen from "./screens/User/controls/ControlScreen";
import AppInfo from "./screens/User/controls/appInfo";
import TermsAndConditions from "./screens/User/controls/TermsAndConditions";
import PrivacyPolicy from "./screens/User/controls/PrivacyPolicy";
import InternetOfTsiken from "./screens/User/controls/InternetOfTsiken";
import UserProfile from "./screens/User/Profile/userProfile";
import EditProfile from "./screens/User/Profile/editProfile";
import UserActivityLogs from "./screens/User/ActivityLogs/ActivityLogs";
import AdminActivityLogs from "./screens/Admin/activityLogs";
import Reports from "./screens/User/Reports/Reports";
import ViewReport from "./screens/User/Reports/ViewReport";
import Analytics from "./screens/User/Analytics/analytics";
import AdminDashboard from "./screens/Admin/adminDashboard";
import UserManagement from "./screens/Admin/userManagement";
import CreateAccount from "./screens/Admin/createAccount";
import AdminAnalytics from "./screens/Admin/adminAnalytics";
import AdminNotification from "./screens/Admin/AdminNotification";
import { AdminNotificationProvider } from "./screens/Admin/AdminNotificationContext";
import Header from "./screens/navigation/Header";
import BottomNavigation from "./screens/navigation/BottomNavigation";

const Stack = createNativeStackNavigator();

// Reusable Branded Alert Modal Component
const BrandedAlertModal = ({ visible, type, title, message, onClose }) => {
  const getIconConfig = () => {
    switch (type) {
      case "success":
        return { name: "check-circle", color: "#4CAF50" };
      case "error":
        return { name: "alert-circle", color: "#c41e3a" };
      case "info":
        return { name: "information", color: "#2196F3" };
      default:
        return { name: "information", color: "#2196F3" };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.alertOverlay}>
        <View style={styles.alertModal}>
          <View
            style={[
              styles.alertIconContainer,
              { backgroundColor: `${iconConfig.color}20` },
            ]}
          >
            <MaterialCommunityIcons
              name={iconConfig.name}
              size={48}
              color={iconConfig.color}
            />
          </View>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <TouchableOpacity style={styles.alertButton} onPress={onClose}>
            <Text style={styles.alertButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Screens that should NOT show the fixed header and bottom nav
const AUTH_SCREENS = [
  "JsonSplash",
  "LogIn",
  "LoginSuccess",
  "VerifyIdentity",
  "PasswordUpdated",
  "ResetPassword",
  "MobileNumberInput",
  "OTPVerification",
  "ConfirmPassword",
  "CreateNewPassword",
  "AdminDashboard",
  "UserManagement",
  "CreateAccount",
  "AdminAnalytics",
  "AdminActivityLogs",
  "AdminNotification",
];

// Screen wrapper that reports its route name to parent
function ScreenWithRouteTracker({
  component: Component,
  routeName,
  onRouteChange,
  ...props
}) {
  useFocusEffect(
    useCallback(() => {
      onRouteChange(routeName);
    }, [routeName, onRouteChange])
  );
  return <Component {...props} />;
}

// Create screen component factory
function createTrackedScreen(Component, routeName, onRouteChange) {
  return function TrackedScreen(props) {
    return (
      <ScreenWithRouteTracker
        component={Component}
        routeName={routeName}
        onRouteChange={onRouteChange}
        {...props}
      />
    );
  };
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState("JsonSplash");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  // Don't change initialRoute after first render - it causes Stack.Navigator remount
  const initialRouteRef = useRef("JsonSplash");
  const [hasInitialized, setHasInitialized] = useState(false);
  const hasInitializedRef = useRef(false);
  const isAuthScreen = AUTH_SCREENS.includes(currentRoute);

  // Alert Modal State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertType, setAlertType] = useState("info");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (type, title, message) => {
    setAlertType(type);
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const closeAlert = () => {
    setAlertVisible(false);
  };

  // Listen to authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log(
        "🔔 Auth listener fired - hasInitialized:",
        hasInitializedRef.current
      );

      // CRITICAL: Check if we're in the middle of a login flow FIRST
      // Exit early to prevent ANY state updates that could interfere with navigation
      const isLoginInProgress = await AsyncStorage.getItem("loginInProgress");
      if (isLoginInProgress === "true") {
        console.log("⏸️ Login in progress - App.js skipping ALL auth handling");
        return;
      }

      // Check if we're in the middle of account creation
      const isAccountCreationInProgress = await AsyncStorage.getItem(
        "accountCreationInProgress"
      );
      if (isAccountCreationInProgress === "true") {
        console.log(
          "⏸️ Account creation in progress - App.js skipping ALL auth handling"
        );
        return;
      }

      if (user) {
        console.log("🔐 Auth state changed: User authenticated", user.uid);

        // User is signed in - fetch their role and accountStatus from Firestore
        try {
          // Check if admin bypass first
          const isAdmin = await AsyncStorage.getItem("isAdminBypass");
          if (isAdmin === "true") {
            console.log("👤 Admin bypass detected → AdminDashboard");
            setIsAuthenticated(true);
            if (!hasInitializedRef.current) {
              initialRouteRef.current = "AdminDashboard";
            }
            setAuthLoading(false);
            setHasInitialized(true);
            hasInitializedRef.current = true;
            return;
          }

          // Fetch user data from Firestore
          const userRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const accountStatus = (userData.accountStatus || "").toLowerCase();
            const userRole = (userData.role || "").toLowerCase();

            console.log(
              `📊 Auth state - Status: ${accountStatus}, Role: ${userRole}`
            );

            // Sign out unverified or inactive users - let them go through login flow
            if (!userData.verified || accountStatus === "inactive") {
              console.log(
                "❌ Unverified or inactive user → signing out to force login"
              );
              await auth.signOut();
              setIsAuthenticated(false);
              if (!hasInitializedRef.current) {
                initialRouteRef.current = "LogIn";
              }
              setAuthLoading(false);
              setHasInitialized(true);
              hasInitializedRef.current = true;
              return;
            }

            // REQUIREMENT 5: Account is active → check role and navigate
            setIsAuthenticated(true);

            if (!hasInitializedRef.current) {
              if (accountStatus === "active") {
                if (userRole === "admin") {
                  console.log(
                    "👤 [App.js] Active Admin → Setting initialRoute: AdminDashboard"
                  );
                  initialRouteRef.current = "AdminDashboard";
                } else {
                  console.log(
                    "👤 [App.js] Active User → Setting initialRoute: Home"
                  );
                  initialRouteRef.current = "Home";
                }
              } else {
                // Unknown status - default to Home
                console.log(
                  "⚠️ [App.js] Unknown status → Setting initialRoute: Home (default)"
                );
                initialRouteRef.current = "Home";
              }
              // Mark as initialized immediately after setting route
              setHasInitialized(true);
              hasInitializedRef.current = true;
            } else {
              console.log(
                "✅ [App.js] Already initialized - NOT updating initialRoute (prevents re-mount)"
              );
            }
            setAuthLoading(false);
          } else {
            console.log("❌ User document not found → LogIn");
            setIsAuthenticated(false);
            if (!hasInitializedRef.current) {
              initialRouteRef.current = "LogIn";
              setHasInitialized(true);
              hasInitializedRef.current = true;
            }
            setAuthLoading(false);
          }
        } catch (error) {
          console.error("Error fetching user data in auth listener:", error);
          // On error, default to Home if authenticated
          setIsAuthenticated(true);
          if (!hasInitializedRef.current) {
            initialRouteRef.current = "Home";
            setHasInitialized(true);
            hasInitializedRef.current = true;
          }
          setAuthLoading(false);
        }
      } else {
        // User is signed out
        console.log("🔓 Auth state changed: User signed out");
        setIsAuthenticated(false);

        // CRITICAL: Reset initialization flag on logout
        // This allows App.js to properly set initialRoute on next login
        console.log("🔄 Resetting hasInitializedRef for fresh login flow");
        hasInitializedRef.current = false;
        setHasInitialized(false);

        initialRouteRef.current = "LogIn";
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  // Prevent hardware back button from navigating to auth screens when authenticated
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isAuthenticated && AUTH_SCREENS.includes(currentRoute)) {
          // Prevent going back to auth screens when authenticated
          return true;
        }
        // Allow default back behavior
        return false;
      }
    );

    return () => backHandler.remove();
  }, [isAuthenticated, currentRoute]);

  // Redirect authenticated users away from auth screens
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      // If user is authenticated but on an auth screen, redirect
      if (
        AUTH_SCREENS.includes(currentRoute) &&
        currentRoute !== "AdminDashboard" &&
        currentRoute !== "JsonSplash"
      ) {
        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: initialRouteRef.current }],
          });
        }
      }
    } else if (!isAuthenticated && !authLoading) {
      // If user is not authenticated but on a protected screen, redirect to login
      if (!AUTH_SCREENS.includes(currentRoute)) {
        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: "LogIn" }],
          });
        }
      }
    }
  }, [isAuthenticated, currentRoute, authLoading]);

  const getActiveTab = () => {
    if (currentRoute === "Home") return "Home";
    if (currentRoute === "Control") return "Control";
    if (currentRoute === "Analytics") return "Analytics";
    return "";
  };

  const handleNavigate = (screen) => {
    if (navigationRef.isReady()) {
      // Don't navigate if already on the same screen
      if (currentRoute === screen) {
        return;
      }
      // Use navigate for smooth transitions instead of reset
      navigationRef.navigate(screen);
    }
  };

  // Show loading screen while checking auth state
  if (authLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <>
      <NotificationProvider>
        <AdminNotificationProvider>
          <View style={styles.container}>
            <NavigationContainer ref={navigationRef}>
              {!isAuthScreen && <Header />}
              <View
                style={[styles.content, !isAuthScreen && styles.contentWithNav]}
              >
                <Stack.Navigator
                  initialRouteName={initialRouteRef.current}
                  screenOptions={{
                    headerShown: false,
                    animation: "slide_from_right",
                    contentStyle: { backgroundColor: "#F4F6FA" },
                    // Prevent back navigation to auth screens when authenticated
                    gestureEnabled: !isAuthenticated || isAuthScreen,
                  }}
                >
                  {/* Auth screens */}
                  <Stack.Screen
                    name="JsonSplash"
                    component={createTrackedScreen(
                      JsonSplashScreen,
                      "JsonSplash",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="LogIn"
                    component={createTrackedScreen(
                      LogIn,
                      "LogIn",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="LoginSuccess"
                    component={createTrackedScreen(
                      LoginSuccess,
                      "LoginSuccess",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="VerifyIdentity"
                    component={createTrackedScreen(
                      VerifyIdentity,
                      "VerifyIdentity",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="PasswordUpdated"
                    component={createTrackedScreen(
                      PasswordUpdated,
                      "PasswordUpdated",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="ResetPassword"
                    component={createTrackedScreen(
                      ResetPassword,
                      "ResetPassword",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="MobileNumberInput"
                    component={createTrackedScreen(
                      MobileNumberInput,
                      "MobileNumberInput",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="OTPVerification"
                    component={createTrackedScreen(
                      OTPVerification,
                      "OTPVerification",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="ConfirmPassword"
                    component={createTrackedScreen(
                      ConfirmPassword,
                      "ConfirmPassword",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="CreateNewPassword"
                    component={createTrackedScreen(
                      CreateNewPassword,
                      "CreateNewPassword",
                      setCurrentRoute
                    )}
                  />

                  {/* Main app screens */}
                  <Stack.Screen
                    name="Home"
                    component={createTrackedScreen(
                      Home,
                      "Home",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="Notification"
                    component={createTrackedScreen(
                      Notification,
                      "Notification",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="Control"
                    component={createTrackedScreen(
                      ControlScreen,
                      "Control",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="Settings"
                    component={createTrackedScreen(
                      AppInfo,
                      "Settings",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="TermsAndConditions"
                    component={createTrackedScreen(
                      TermsAndConditions,
                      "TermsAndConditions",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="PrivacyPolicy"
                    component={createTrackedScreen(
                      PrivacyPolicy,
                      "PrivacyPolicy",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="InternetOfTsiken"
                    component={createTrackedScreen(
                      InternetOfTsiken,
                      "InternetOfTsiken",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="UserProfile"
                    component={createTrackedScreen(
                      UserProfile,
                      "UserProfile",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="EditProfile"
                    component={createTrackedScreen(
                      EditProfile,
                      "EditProfile",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="ActivityLogs"
                    component={createTrackedScreen(
                      UserActivityLogs,
                      "ActivityLogs",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="AdminActivityLogs"
                    component={createTrackedScreen(
                      AdminActivityLogs,
                      "AdminActivityLogs",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="Reports"
                    component={createTrackedScreen(
                      Reports,
                      "Reports",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="ViewReport"
                    component={createTrackedScreen(
                      ViewReport,
                      "ViewReport",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="Analytics"
                    component={createTrackedScreen(
                      Analytics,
                      "Analytics",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="AdminDashboard"
                    component={createTrackedScreen(
                      AdminDashboard,
                      "AdminDashboard",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="UserManagement"
                    component={createTrackedScreen(
                      UserManagement,
                      "UserManagement",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="CreateAccount"
                    component={createTrackedScreen(
                      CreateAccount,
                      "CreateAccount",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="AdminAnalytics"
                    component={createTrackedScreen(
                      AdminAnalytics,
                      "AdminAnalytics",
                      setCurrentRoute
                    )}
                  />
                  <Stack.Screen
                    name="AdminNotification"
                    component={createTrackedScreen(
                      AdminNotification,
                      "AdminNotification",
                      setCurrentRoute
                    )}
                  />
                </Stack.Navigator>
              </View>
              {!isAuthScreen && (
                <View style={styles.bottomNavContainer}>
                  <BottomNavigation
                    active={getActiveTab()}
                    onNavigate={handleNavigate}
                  />
                </View>
              )}
            </NavigationContainer>
          </View>
        </AdminNotificationProvider>
      </NotificationProvider>

      {/* Branded Alert Modal for Inactive Account */}
      <BrandedAlertModal
        visible={alertVisible}
        type={alertType}
        title={alertTitle}
        message={alertMessage}
        onClose={closeAlert}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6FA" },
  content: { flex: 1 },
  contentWithNav: { paddingBottom: 70 },
  bottomNavContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  // Alert Modal Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
  },
  alertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#133E87",
    textAlign: "center",
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  alertButton: {
    backgroundColor: "#133E87",
    paddingVertical: 12,
    paddingHorizontal: 48,
    borderRadius: 8,
    minWidth: 120,
  },
  alertButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
