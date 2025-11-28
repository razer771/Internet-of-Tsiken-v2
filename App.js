import React, { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { navigationRef } from "./services/NavigationService";

// Components are imported with the correct path and names
import JsonSplashScreen from "./JsonSplashScreen/JsonSplashScreen";
import Login from "./screens/LogIn/LogIn";
import SignUp from "./screens/LogIn/SignUp";
import LoginSuccess from "./screens/LogIn/loginSuccess";
import VerifyIdentity from "./screens/LogIn/verifyIdentity";
import PasswordUpdated from "./screens/LogIn/passwordupdated";
import ResetPassword from "./screens/LogIn/resetpassword";
import Home from "./screens/Dashboard/Home";
import Notification from "./screens/controls/Notification";
import ControlScreen from "./screens/controls/ControlScreen";
import Settings from "./screens/controls/Settings";
import UserProfile from "./screens/Profile/userProfile";
import EditProfile from "./screens/Profile/editProfile";
import ActivityLogs from "./screens/ActivityLogs/ActivityLogs";
import Reports from "./screens/Reports/Reports";
import ViewReport from "./screens/Reports/ViewReport";
import Header from "./screens/navigation/Header";
import BottomNavigation from "./screens/navigation/BottomNavigation";

const Stack = createNativeStackNavigator();

// Screens that should NOT show the fixed header and bottom nav
const AUTH_SCREENS = ["JsonSplash", "LogIn", "Signup", "LoginSuccess", "VerifyIdentity", "PasswordUpdated", "ResetPassword"];

// Screen wrapper that reports its route name to parent
function ScreenWithRouteTracker({ component: Component, routeName, onRouteChange, ...props }) {
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
  
  const isAuthScreen = AUTH_SCREENS.includes(currentRoute);

  // Determine active tab for bottom nav
  const getActiveTab = () => {
    if (currentRoute === "Home") return "Home";
    if (currentRoute === "Control") return "Control";
    if (currentRoute === "Analytics") return "Analytics";
    return "";
  };

  const handleNavigate = (screen) => {
    if (navigationRef.isReady()) {
      // Use goBack for better animation when going back to Home from Control
      if (screen === "Home" && currentRoute === "Control") {
        navigationRef.goBack();
      } else {
        navigationRef.navigate(screen);
      }
    }
  };

  return (
    <View style={styles.container}>
      <NavigationContainer ref={navigationRef}>
        {/* Fixed Header - only show for non-auth screens */}
        {!isAuthScreen && (
          <Header />
        )}
        
        {/* Main Content Area */}
        <View style={[styles.content, !isAuthScreen && styles.contentWithNav]}>
          <Stack.Navigator
            initialRouteName="JsonSplash"
            screenOptions={{ 
              headerShown: false,
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#F4F6FA" },
            }}
          >
            {/* Auth screens */}
            <Stack.Screen name="JsonSplash" component={createTrackedScreen(JsonSplashScreen, "JsonSplash", setCurrentRoute)} />
            <Stack.Screen name="LogIn" component={createTrackedScreen(Login, "LogIn", setCurrentRoute)} />
            <Stack.Screen name="Signup" component={createTrackedScreen(SignUp, "Signup", setCurrentRoute)} />
            <Stack.Screen name="LoginSuccess" component={createTrackedScreen(LoginSuccess, "LoginSuccess", setCurrentRoute)} />
            <Stack.Screen name="VerifyIdentity" component={createTrackedScreen(VerifyIdentity, "VerifyIdentity", setCurrentRoute)} />
            <Stack.Screen name="PasswordUpdated" component={createTrackedScreen(PasswordUpdated, "PasswordUpdated", setCurrentRoute)} />
            <Stack.Screen name="ResetPassword" component={createTrackedScreen(ResetPassword, "ResetPassword", setCurrentRoute)} />
            
            {/* Main app screens */}
            <Stack.Screen name="Home" component={createTrackedScreen(Home, "Home", setCurrentRoute)} />
            <Stack.Screen name="Notification" component={createTrackedScreen(Notification, "Notification", setCurrentRoute)} />
            <Stack.Screen name="Control" component={createTrackedScreen(ControlScreen, "Control", setCurrentRoute)} />
            <Stack.Screen name="Settings" component={createTrackedScreen(Settings, "Settings", setCurrentRoute)} />
            <Stack.Screen name="UserProfile" component={createTrackedScreen(UserProfile, "UserProfile", setCurrentRoute)} />
            <Stack.Screen name="EditProfile" component={createTrackedScreen(EditProfile, "EditProfile", setCurrentRoute)} />
            <Stack.Screen name="ActivityLogs" component={createTrackedScreen(ActivityLogs, "ActivityLogs", setCurrentRoute)} />
            <Stack.Screen name="Reports" component={createTrackedScreen(Reports, "Reports", setCurrentRoute)} />
            <Stack.Screen name="ViewReport" component={createTrackedScreen(ViewReport, "ViewReport", setCurrentRoute)} />
          </Stack.Navigator>
        </View>
        
        {/* Fixed Bottom Navigation - only show for non-auth screens */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6FA",
  },
  content: {
    flex: 1,
  },
  contentWithNav: {
    // Add padding at bottom so content isn't blocked by bottom nav
    paddingBottom: 70,
  },
  bottomNavContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});