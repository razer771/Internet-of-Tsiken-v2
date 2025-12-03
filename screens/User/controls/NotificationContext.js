import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NotificationContext = createContext();

const STORAGE_KEY = "@notifications";

const defaultNotifications = [
  { id: 1, category: "IoT: Internet of Tsiken", title: "Temperature too high/low", time: "October 21, 2025 (09:19 PM)", read: false },
  { id: 2, category: "IoT: Internet of Tsiken", title: "Feeder empty", time: "October 21, 2025 (09:19 PM)", read: false },
  { id: 3, category: "IoT: Internet of Tsiken", title: "Water low", time: "October 21, 2025 (09:19 PM)", read: true },
  { id: 4, category: "IoT: Internet of Tsiken", title: "Switched to Solar Mode", time: "October 21, 2025 (09:19 PM)", read: true },
  { id: 5, category: "IoT: Internet of Tsiken", title: "Power outage", time: "October 21, 2025 (09:19 PM)", read: false },
];

export function NotificationProvider({ children }) {
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
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveNotifications = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error("Error saving notifications:", error);
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
    <NotificationContext.Provider
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
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
