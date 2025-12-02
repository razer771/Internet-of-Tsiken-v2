import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

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
import TermsAndConditions from "./screens/controls/TermsAndConditions";
import PrivacyPolicy from "./screens/controls/PrivacyPolicy";
import InternetOfTsiken from "./screens/controls/InternetOfTsiken";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="JsonSplash"
        screenOptions={{ headerShown: false }}
        
      >
        <Stack.Screen name="JsonSplash" component={JsonSplashScreen} />
        {/* Screen names must match the navigation calls in the components (e.g., handleSignup in tryLogIn.js navigates to "Signup") */}
        <Stack.Screen name="LogIn" component={Login} />
        <Stack.Screen name="Signup" component={SignUp} />
        <Stack.Screen name="LoginSuccess" component={LoginSuccess} />
        <Stack.Screen name="VerifyIdentity" component={VerifyIdentity} />
        <Stack.Screen name="PasswordUpdated" component={PasswordUpdated} />
        <Stack.Screen name="ResetPassword" component={ResetPassword} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Notification" component={Notification} />
        <Stack.Screen name="Control" component={ControlScreen} />
        <Stack.Screen name="Settings" component={Settings} />
        <Stack.Screen name="TermsAndConditions" component={TermsAndConditions} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
        <Stack.Screen name="InternetOfTsiken" component={InternetOfTsiken} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}