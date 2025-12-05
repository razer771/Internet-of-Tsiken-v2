import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AdminNotificationContext = createContext();

const STORAGE_KEY = "@admin_notifications";

const defaultNotifications = [
  { id: 1, category: "User Management", title: "New user registered", description: "A new user has registered to the system.", time: "December 4, 2025 (09:19 PM)", read: false },
  { id: 2, category: "System Alert", title: "High temperature detected", description: "Temperature exceeded normal range in brooder area.", time: "December 4, 2025 (09:15 PM)", read: false },
  { id: 3, category: "Schedule Management", title: "Feeding schedule updated", description: "User updated feeding schedule for 10:00 AM.", time: "December 4, 2025 (08:30 PM)", read: true },
  { id: 4, category: "User Activity", title: "Manual watering completed", description: "User activated sprinkler manually at 6:45 PM.", time: "December 4, 2025 (06:45 PM)", read: true },
  { id: 5, category: "System Alert", title: "Low feed level", description: "Feed container is running low. Please refill soon.", time: "December 4, 2025 (05:00 PM)", read: false },
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
