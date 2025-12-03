import "react-native-gesture-handler";
import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, BackHandler } from "react-native";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { navigationRef } from "./services/NavigationService";
import * as SplashScreen from "expo-splash-screen";
import { NotificationProvider } from "./screens/User/controls/NotificationContext";
import { auth } from "./config/firebaseconfig";
import { onAuthStateChanged } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const [initialRoute, setInitialRoute] = useState("JsonSplash");
  const isAuthScreen = AUTH_SCREENS.includes(currentRoute);

  // Listen to authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in
        setIsAuthenticated(true);
        // Check if user is admin
        const isAdmin = await AsyncStorage.getItem("isAdminBypass");
        if (isAdmin === "true") {
          setInitialRoute("AdminDashboard");
        } else {
          setInitialRoute("Home");
        }
      } else {
        // User is signed out
        setIsAuthenticated(false);
        setInitialRoute("LogIn");
      }
      setAuthLoading(false);
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
      if (AUTH_SCREENS.includes(currentRoute) && currentRoute !== "AdminDashboard" && currentRoute !== "JsonSplash") {
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

  // Show loading screen while checking auth state
  if (authLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <NotificationProvider>
      <AdminNotificationProvider>
        <View style={styles.container}>
          <NavigationContainer ref={navigationRef}>
          {!isAuthScreen && <Header />}
          <View style={[styles.content, !isAuthScreen && styles.contentWithNav]}>
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
              component={createTrackedScreen(LogIn, "LogIn", setCurrentRoute)}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6FA" },
  content: { flex: 1 },
  contentWithNav: { paddingBottom: 70 },
  bottomNavContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  centerContent: { 
    justifyContent: "center", 
    alignItems: "center" 
  },
});
