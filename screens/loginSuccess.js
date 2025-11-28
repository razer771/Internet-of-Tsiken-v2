import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../config/firebaseconfig';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginSuccess() {
  const navigation = useNavigation();

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log("✅ User dashboard data loaded:", userData);
            // Store in global state if needed
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };

    loadUserData();

    const timer = setTimeout(() => {
      console.log('Dashboard loaded!');
      // TODO: Navigate to your main app screen when ready
      // navigation.replace("Home");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image
          source={{ uri: 'https://img.icons8.com/color/96/checked--v1.png' }}
          style={styles.icon}
        />
        <Text style={styles.title}>Login Successful!</Text>
        <Text style={styles.subtitle}>Welcome to Internet of Tsiken</Text>
        <Text style={styles.loading}>Loading your dashboard...</Text>
        <ActivityIndicator size="large" color="#4CAF50" style={styles.spinner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 30,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  icon: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  loading: {
    fontSize: 16,
    color: '#888',
    marginBottom: 10,
    textAlign: 'center',
  },
  spinner: {
    marginTop: 10,
  },
});