import "react-native-gesture-handler";
import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, BackHandler } from "react-native";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { navigationRef } from "./services/NavigationService";
import * as SplashScreen from "expo-splash-screen";
import { NotificationProvider } from "./screens/User/controls/NotificationContext";
import { AdminNotificationProvider } from "./screens/Admin/AdminNotificationContext";
import { auth } from "./config/firebaseconfig";
import { onAuthStateChanged } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { validateAdminSession, clearAdminSession } from "./services/AdminSessionService.js";

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
import Header from "./screens/navigation/Header";
import AdminHeader from "./screens/navigation/adminHeader";
import BottomNavigation from "./screens/navigation/BottomNavigation";
import ActivityLogs from "./screens/Admin/activityLogs";

const Stack = createNativeStackNavigator();

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
];

// Admin screens (no header/bottom nav, but should not trigger redirects)
const ADMIN_SCREENS = [
  "AdminDashboard",
  "UserManagement",
  "CreateAccount",
  "AdminAnalytics",
  "AdminActivityLogs",
  "AdminNotification",
];

// Combined list for UI rendering (screens without header/bottom nav)
const NO_NAV_SCREENS = [...AUTH_SCREENS, ...ADMIN_SCREENS];

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState("JsonSplash");
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const isAuthScreen = AUTH_SCREENS.includes(currentRoute);
  const isAdminScreen = ADMIN_SCREENS.includes(currentRoute);

  // Prepare app and hide Expo splash screen
  useEffect(() => {
    async function prepare() {
      try {
        // Keep Expo splash visible briefly
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  // Listen to authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // User is signed in
          
          // Validate admin session using the session service
          const { isValid, email, role } = await validateAdminSession();
          
          if (isValid) {
            setIsAuthenticated(true);
            setIsAdmin(true);
            setInitialRoute("AdminDashboard");
            console.log(`✓ Admin session active for: ${email} (${role})`);
          } else {
            // Regular user - require fresh login after app restart
            // Check if this is a fresh app start by checking AsyncStorage flag
            const hasActiveSession = await AsyncStorage.getItem("@user_active_session");
            
            if (hasActiveSession === "true") {
              // User had an active session
              setIsAuthenticated(true);
              setIsAdmin(false);
              setInitialRoute("Home");
            } else {
              // No active session flag - require login
              setIsAuthenticated(false);
              setIsAdmin(false);
              setInitialRoute("LogIn");
              // Sign out from Firebase
              await auth.signOut();
              console.log("No active user session - redirecting to login");
            }
          }
        } else {
          // User is signed out - clear all session data
          setIsAuthenticated(false);
          setIsAdmin(false);
          setInitialRoute("LogIn");
          
          // Clear admin session using the session service
          await clearAdminSession();
          // Clear user session flag
          await AsyncStorage.removeItem("@user_active_session");
        }
      } catch (error) {
        console.error("Error in auth state change:", error);
        // Fallback to safe defaults
        setIsAuthenticated(false);
        setIsAdmin(false);
        setInitialRoute("LogIn");
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Hide custom splash screen after animation completes
  useEffect(() => {
    if (!appReady) return;
    
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3500); // Match animation duration
    
    return () => clearTimeout(timer);
  }, [appReady]);

  // Prevent hardware back button from navigating to auth screens when authenticated
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isAuthenticated && AUTH_SCREENS.includes(currentRoute)) {
          // Prevent going back to auth screens when authenticated (not admin screens)
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
      // If user is authenticated but on an actual auth screen (not admin screens), redirect
      if (
        AUTH_SCREENS.includes(currentRoute) &&
        currentRoute !== "JsonSplash"
      ) {
        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: initialRoute }],
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
  }, [isAuthenticated, currentRoute, authLoading, initialRoute]);

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

  // Don't render anything until app is ready
  if (!appReady) {
    return null;
  }

  // Show custom splash screen while checking auth state
  if (authLoading || showSplash) {
    return (
      <View style={styles.splashContainer}>
        <JsonSplashScreen />
      </View>
    );
  }

  return (
    <NotificationProvider>
      <AdminNotificationProvider>
        <View style={styles.container}>
          <NavigationContainer ref={navigationRef}>
            {!isAuthScreen && !isAdminScreen && <Header />}
            <View
              style={[styles.content, !isAuthScreen && !isAdminScreen && styles.contentWithNav]}
            >
              <Stack.Navigator
                initialRouteName={initialRoute}
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
                  component={createTrackedScreen(Home, "Home", setCurrentRoute)}
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
            {!isAuthScreen && !isAdminScreen && (
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
  splashContainer: {
    flex: 1,
    backgroundColor: "#24208fff",
  },
});