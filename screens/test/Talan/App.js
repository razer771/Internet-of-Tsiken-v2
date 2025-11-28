<<<<<<< HEAD
import React from "react";
import { View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import Icon from "react-native-vector-icons/Feather";
import Header from "./screens/Components/Header";
import Home from "./screens/Home";
import Reports from "./screens/Reports";
import ViewReport from "./screens/ViewReport";
import ActivityLogs from "./screens/ActivityLogs";
import CustomTabBar from "./screens/Components/BottomNavigation";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const Placeholder = () => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    <Text>Coming Soon</Text>
  </View>
);

function ReportsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReportsList" component={Reports} />
      <Stack.Screen name="ViewReport" component={ViewReport} />
    </Stack.Navigator>
  );
}

function ActivityLogsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ActivityLogsList" component={ActivityLogs} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <View style={{ flex: 1 }}>
        <Header />
        <Tab.Navigator
          screenOptions={{ headerShown: false }}
          tabBar={(props) => <CustomTabBar {...props} />}
        >
          <Tab.Screen
            name="Home"
            component={Home}
            options={{
              tabBarLabel: "Home",
              tabBarIcon: ({ focused }) => (
                <Icon
                  name="home"
                  size={22}
                  color={focused ? "#1e40af" : "#1a1a1a"}
                />
              ),
            }}
          />
          <Tab.Screen
            name="Control"
            component={Placeholder}
            options={{
              tabBarLabel: "Control",
              tabBarIcon: ({ focused }) => (
                <Icon
                  name="sliders"
                  size={22}
                  color={focused ? "#1e40af" : "#1a1a1a"}
                />
              ),
            }}
          />
          <Tab.Screen
            name="Analytics"
            component={Placeholder}
            options={{
              tabBarLabel: "Analytics",
              tabBarIcon: ({ focused }) => (
                <Icon
                  name="bar-chart-2"
                  size={22}
                  color={focused ? "#1e40af" : "#1a1a1a"}
                />
              ),
            }}
          />
          <Tab.Screen
            name="Reports"
            component={ReportsStack}
            options={{
              tabBarButton: () => null,
            }}
          />
          <Tab.Screen
            name="ActivityLogs"
            component={ActivityLogsStack}
            options={{
              tabBarButton: () => null,
            }}
          />
        </Tab.Navigator>
      </View>
    </NavigationContainer>
  );
}
=======
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

export default function QuickOverviewSetup() {
  const [chicksCount, setChicksCount] = useState('');
  const [daysCount, setDaysCount] = useState('');

  const handleSaveChicksCount = () => {
    console.log('Saving chicks count:', chicksCount);
  };

  const handleSaveDaysCount = () => {
    console.log('Saving days count:', daysCount);
  };

  const handleBack = () => {
    console.log('Navigate back to dashboard');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Quick Overview Setup</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.card}>
          {/* Chicks Input Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Number of Chicks per Batch</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter number of chicks"
              value={chicksCount}
              onChangeText={setChicksCount}
              keyboardType="numeric"
            />
            <TouchableOpacity onPress={handleSaveChicksCount} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save Chicks Count</Text>
            </TouchableOpacity>
          </View>

          {/* Days Input Section */}
          <View style={styles.section}>
            <Text style={styles.label}>Number of Days per Batch</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter number of days (1-45)"
              value={daysCount}
              onChangeText={setDaysCount}
              keyboardType="numeric"
            />
            <TouchableOpacity onPress={handleSaveDaysCount} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save Days Count</Text>
            </TouchableOpacity>
          </View>

          {/* Back to Dashboard Button */}
          <TouchableOpacity onPress={handleBack} style={styles.backToDashboardButton}>
            <Text style={styles.backToDashboardText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' }, // bg-gray-50
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb', // border-gray-200
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827', // text-gray-900
    marginLeft: 8,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827', // text-gray-900
    marginBottom: 8,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e5e7eb', // border-gray-200
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    color: '#111827', // text-gray-900
  },
  saveButton: {
    backgroundColor: '#1e40af', // bg-blue-900
    borderRadius: 12,
    paddingVertical: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  backToDashboardButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb', // border-gray-200
    borderRadius: 12,
    paddingVertical: 12,
  },
  backToDashboardText: {
    color: '#4b5563', // text-gray-700
    fontWeight: '500',
    textAlign: 'center',
  },
});
>>>>>>> 1fb77ad849c6f367548554bb9b62eedb9d42cad7
