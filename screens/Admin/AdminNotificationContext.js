import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../../config/firebaseconfig";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";

const AdminNotificationContext = createContext();

const STORAGE_KEY = "@admin_notifications";

const defaultNotifications = [
  { 
    id: 1, 
    category: "User Management", 
    title: "New user registration", 
    description: "John Doe has registered a new account",
    time: "December 4, 2025 (10:30 AM)", 
    read: false,
    type: "user_registration"
  },
  { 
    id: 2, 
    category: "System Alert", 
    title: "High activity detected", 
    description: "Unusual number of login attempts detected",
    time: "December 4, 2025 (09:45 AM)", 
    read: false,
    type: "security"
  },
  { 
    id: 3, 
    category: "IoT Device", 
    title: "Device offline", 
    description: "Brooder #5 has gone offline",
    time: "December 4, 2025 (08:20 AM)", 
    read: true,
    type: "device"
  },
  { 
    id: 4, 
    category: "User Activity", 
    title: "Batch completed", 
    description: "User Maria Santos completed batch harvest",
    time: "December 3, 2025 (05:15 PM)", 
    read: true,
    type: "batch"
  },
  { 
    id: 5, 
    category: "System Alert", 
    title: "Database backup completed", 
    description: "Automated backup completed successfully",
    time: "December 3, 2025 (02:00 AM)", 
    read: false,
    type: "system"
  },
  { 
    id: 6, 
    category: "User Management", 
    title: "Account deletion request", 
    description: "User requested account deletion",
    time: "December 2, 2025 (11:30 AM)", 
    read: false,
    type: "user_management"
  },
  { 
    id: 7, 
    category: "IoT Device", 
    title: "Sensor calibration needed", 
    description: "Temperature sensor in Brooder #3 needs calibration",
    time: "December 2, 2025 (09:00 AM)", 
    read: true,
    type: "device"
  },
  { 
    id: 8, 
    category: "Analytics", 
    title: "Weekly report ready", 
    description: "System performance report for Nov 25 - Dec 1 is ready",
    time: "December 1, 2025 (08:00 AM)", 
    read: false,
    type: "report"
  },
];

export function AdminNotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [loading, setLoading] = useState(true);

  // Load notifications from AsyncStorage on mount
  useEffect(() => {
    loadNotifications();
  }, []);

  // Save notifications to AsyncStorage whenever they change
  useEffect(() => {
    if (!loading) {
      saveNotifications();
    }
  }, [notifications]);

  // Optional: Listen to Firebase for real-time admin notifications
  useEffect(() => {
    // You can implement Firebase listener here for real-time notifications
    // Example: Listen to activity logs, user registrations, etc.
    /*
    const logsQuery = query(
      collection(db, "admin_notifications"),
      orderBy("timestamp", "desc"),
      limit(50)
    );
    
    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        read: false,
      }));
      
      // Merge with existing notifications
      setNotifications(prev => {
        const merged = [...newNotifications];
        prev.forEach(n => {
          if (!merged.find(m => m.id === n.id)) {
            merged.push(n);
          }
        });
        return merged;
      });
    });

    return () => unsubscribe();
    */
  }, []);

  const loadNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setNotifications(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading admin notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveNotifications = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error("Error saving admin notifications:", error);
    }
  };

  // Get unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Mark a single notification as read
  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Mark all as unread
  const markAllAsUnread = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: false })));
  };

  // Toggle all read/unread
  const toggleAllRead = () => {
    const allRead = notifications.every(n => n.read);
    if (allRead) {
      markAllAsUnread();
    } else {
      markAllAsRead();
    }
  };

  // Add a new notification
  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      read: false,
      time: new Date().toLocaleString(),
      description: "",
      ...notification,
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  // Delete a notification
  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    setNotifications([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  // Filter notifications by type
  const getNotificationsByType = (type) => {
    return notifications.filter(n => n.type === type);
  };

  // Filter notifications by category
  const getNotificationsByCategory = (category) => {
    return notifications.filter(n => n.category === category);
  };

  return (
    <AdminNotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        markAllAsUnread,
        toggleAllRead,
        addNotification,
        deleteNotification,
        clearAllNotifications,
        getNotificationsByType,
        getNotificationsByCategory,
      }}
    >
      {children}
    </AdminNotificationContext.Provider>
  );
}

export function useAdminNotifications() {
  const context = useContext(AdminNotificationContext);
  if (!context) {
    throw new Error("useAdminNotifications must be used within an AdminNotificationProvider");
  }
  return context;
}
