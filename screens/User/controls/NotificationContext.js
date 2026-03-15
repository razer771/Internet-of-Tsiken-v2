import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../../../config/firebaseconfig";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

const NotificationContext = createContext();

const STORAGE_KEY = "@notifications_read_state";

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [readState, setReadState] = useState({});
  const [loading, setLoading] = useState(true);

  // Load read state from AsyncStorage
  useEffect(() => {
    const loadReadState = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setReadState(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Error loading notification read states:", error);
      }
    };
    loadReadState();
  }, []);

  // Set up Firebase listener
  useEffect(() => {
    const q = query(
      collection(db, "predator_attacks"),
      orderBy("timestamp", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedNotifications = snapshot.docs.map((doc) => {
          const data = doc.data();

          // Format the date for UI (e.g. October 21, 2025 (09:19 PM))
          let timeStr = data.time || "";
          let dateStr = data.date || data.timestamp || "";
          try {
            if (data.timestamp) {
              const d = new Date(data.timestamp);
              const months = [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
              ];
              const month = months[d.getMonth()];
              const day = d.getDate();
              const year = d.getFullYear();
              let hours = d.getHours();
              const minutes = String(d.getMinutes()).padStart(2, "0");
              const ampm = hours >= 12 ? "PM" : "AM";
              hours = hours % 12 || 12;
              timeStr = `${month} ${day}, ${year} (${hours}:${minutes} ${ampm})`;
            }
          } catch (e) {}

          const titleText =
            data.type === "predator" || data.predator
              ? `Predator Alert: ${data.predator || "Unknown"}`
              : "System Alert";
          const descText = data.predator
            ? `A ${data.predator} has been detected near your chicken coop!`
            : "System notification received.";

          return {
            id: doc.id,
            category: "IoT: Internet of Tsiken",
            title: titleText,
            description: descText,
            time: timeStr !== "" ? timeStr : new Date().toLocaleString(),
            // Read state defaults to false until checked locally
          };
        });

        setNotifications(fetchedNotifications);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching predator attacks:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // Derived state combining firebase data and local read status
  const finalNotifications = notifications.map((n) => ({
    ...n,
    read: !!readState[n.id],
  }));

  const saveReadState = async (newState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.error("Error saving read status:", error);
    }
  };

  // Get unread count
  const unreadCount = finalNotifications.filter((n) => !n.read).length;

  // Mark a single notification as read
  const markAsRead = (id) => {
    const newState = { ...readState, [id]: true };
    setReadState(newState);
    saveReadState(newState);
  };

  // Mark all as read
  const markAllAsRead = () => {
    const newState = { ...readState };
    notifications.forEach((n) => (newState[n.id] = true));
    setReadState(newState);
    saveReadState(newState);
  };

  // Mark all as unread
  const markAllAsUnread = () => {
    const newState = { ...readState };
    notifications.forEach((n) => (newState[n.id] = false));
    setReadState(newState);
    saveReadState(newState);
  };

  // Toggle all read/unread
  const toggleAllRead = () => {
    const allRead = finalNotifications.every((n) => n.read);
    if (allRead) {
      markAllAsUnread();
    } else {
      markAllAsRead();
    }
  };

  // Add a new notification (For local temporary ones)
  const addNotification = (notification) => {
    // Note: Since we are syncing from Firebase, manual local addition
    // will be overridden unless we merge local and firebase arrays.
    // For now, we rely solely on Firestore.
    console.log(
      "Adding local notification is mocked when using Firebase sync",
      notification,
    );
  };

  // Delete a notification
  const deleteNotification = (id) => {
    // If you want to delete from firebase, do it here.
    // Otherwise just hide locally. Let's hide locally.
    console.log(
      "Delete notification not fully implemented with Firebase sync",
      id,
    );
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    // Clearing local read states
    setReadState({});
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications: finalNotifications,
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
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
}
