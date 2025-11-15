import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Components are imported with the correct path and names
import JsonSplashScreen from "./JsonSplashScreen/JsonSplashScreen";
import Login from "./screens/Login";
import SignUp from "./screens/SignUp";
import LoginSuccess from "./screens/loginSuccess";
import VerifyIdentity from "./screens/verifyIdentity";
import PasswordUpdated from "./screens/passwordupdated";
import ResetPassword from "./screens/resetpassword";

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
        <Stack.Screen name="LogIn" component={LogIn} />
        <Stack.Screen name="Signup" component={SignUp} />
        <Stack.Screen name="LoginSuccess" component={LoginSuccess} />
        <Stack.Screen name="VerifyIdentity" component={VerifyIdentity} />
        <Stack.Screen name="PasswordUpdated" component={PasswordUpdated} />
        <Stack.Screen name="ResetPassword" component={ResetPassword} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}