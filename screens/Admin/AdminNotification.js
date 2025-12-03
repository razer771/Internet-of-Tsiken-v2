import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Pressable, SafeAreaView } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import { useAdminNotifications } from "./AdminNotificationContext";
import Header2 from "../navigation/adminHeader";

const PRIMARY = "#133E87";
const BORDER_LIGHT = "rgba(0,0,0,0.12)";
const NOTIF_BORDER = "rgba(0,0,0,0.1)";

const TimePeriod = ["Daily", "Weekly", "Monthly"];

function SmallCalendar({ onClose }) {
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);

  const base = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [monthOffset]);

  const monthName = new Date(base.year, base.month).toLocaleString(undefined, { month: "long" });

  const grid = useMemo(() => {
    const first = new Date(base.year, base.month, 1).getDay();
    const days = new Date(base.year, base.month + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [base]);

  const isToday = (d) => {
    if (!d) return false;
    const now = new Date();
    return base.year === now.getFullYear() && base.month === now.getMonth() && d === now.getDate();
  };

  return (
    <View style={styles.calendarBox}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={() => setMonthOffset(m => m - 1)} style={styles.calendarNavBtn}>
          <Ionicons name="chevron-back" size={20} color="#222" />
        </TouchableOpacity>
        
        <Text style={{ fontWeight: '600' }}>{monthName} {base.year}</Text>
        
        <TouchableOpacity onPress={() => setMonthOffset(m => m + 1)} style={styles.calendarNavBtn}>
          <Ionicons name="chevron-forward" size={20} color="#222" />
        </TouchableOpacity>
      </View>

      <View style={styles.calendarDaysRow}>  
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (  
          <View key={d} style={styles.calendarDayName}><Text>{d}</Text></View>  
        ))}  
      </View>  

      <View style={styles.calendarGrid}>  
        {grid.map((item, idx) => (  
          <TouchableOpacity 
            key={idx} 
            style={[styles.calendarDay, isToday(item) && { backgroundColor: PRIMARY }]}  
            onPress={() => item && onClose()} 
            disabled={!item}
          >  
            <Text style={{ color: isToday(item) ? '#fff' : '#222' }}>{item || ""}</Text>  
          </TouchableOpacity>  
        ))}  
      </View>  
    </View>
  );
}

function NotificationItem({ item, onPress }) {
  return (
    <TouchableOpacity 
      style={[styles.notificationItem, { backgroundColor: item.read ? "#e5e7eb" : "#fff" }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={{ fontWeight: '700', color: item.read ? "#6b7280" : "#000" }}>{item.category}: {item.title}</Text>
      <Text style={[styles.notificationText, { color: item.read ? "#9ca3af" : "#666" }]}>
        {item.description || "Lorem ipsum dolor sit amet, consectetur adipiscing elit."}
      </Text>
      <Text style={[styles.notificationTime, { color: item.read ? "#9ca3af" : "#999" }]}>{item.time}</Text>
    </TouchableOpacity>
  );
}

export default function AdminNotification() {
  const [activeTab, setActiveTab] = useState("Daily");
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const navigation = useNavigation();
  const { notifications, toggleAllRead, markAsRead } = useAdminNotifications();

  const allRead = useMemo(() => notifications.every(n => n.read), [notifications]);

  const toggleMarkAll = () => {
    toggleAllRead();
  };

  const handleNotificationPress = (notification) => {
    markAsRead(notification.id);
    setSelectedNotification(notification);
    setDetailModalVisible(true);
  };

  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedNotification(null);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header2 />
      <ScrollView style={styles.wrapper} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={18} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              onPress={toggleMarkAll} 
              style={[styles.markAllBtn, allRead && { backgroundColor: PRIMARY }]}
            >
              <Ionicons name="mail-unread-outline" size={16} color={allRead ? '#fff' : '#222'} />
              <Text style={{ marginLeft: 8, color: allRead ? '#fff' : '#222' }}>
                Mark all as read
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setCalendarVisible(true)} style={[styles.iconBtn, { marginLeft: 8 }]}>  
              <Ionicons name="calendar-outline" size={18} />  
            </TouchableOpacity>
          </View>
        </View>  

        <View style={styles.tabs}>  
          {TimePeriod.map(p => (  
            <TouchableOpacity 
              key={p} 
              onPress={() => setActiveTab(p)} 
              style={[styles.tabBtn, activeTab === p && { backgroundColor: PRIMARY }]}
            >  
              <Text style={{ color: activeTab === p ? '#fff' : PRIMARY }}>{p}</Text>  
            </TouchableOpacity>  
          ))}  
        </View>  

        <View>  
          {notifications.map(n => (
            <NotificationItem 
              key={n.id} 
              item={n} 
              onPress={() => handleNotificationPress(n)}
            />
          ))}  
        </View>  

        <Modal visible={calendarVisible} transparent animationType="slide">  
          <Pressable style={styles.modalOverlay} onPress={() => setCalendarVisible(false)}>  
            <SmallCalendar onClose={() => setCalendarVisible(false)} />  
          </Pressable>  
        </Modal>

        {/* Notification Detail Modal */}
        <Modal visible={detailModalVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={closeDetailModal}>
            <Pressable style={styles.detailModalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.detailModalHeader}>
                <Text style={styles.detailModalTitle}>Notification Details</Text>
                <TouchableOpacity onPress={closeDetailModal} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              {selectedNotification && (
                <View style={styles.detailModalBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>{selectedNotification.category}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Title</Text>
                    <Text style={styles.detailValue}>{selectedNotification.title}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailDescription}>
                      {selectedNotification.description || "Lorem ipsum dolor sit amet, consectetur adipiscing elit."}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Time</Text>
                    <Text style={styles.detailValue}>{selectedNotification.time}</Text>
                  </View>
                </View>
              )}
              
              <TouchableOpacity onPress={closeDetailModal} style={styles.okButton}>
                <Text style={styles.okButtonText}>OK</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#f7fafc", padding: 16 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, flexWrap: 'wrap' },
  iconBtn: { height: 36, width: 36, borderRadius: 8, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", marginRight: 8 },
  markAllBtn: { height: 36, paddingHorizontal: 12, borderRadius: 8, flexDirection: "row", alignItems: "center", marginRight: 8, backgroundColor: "#fff" },
  tabs: { flexDirection: "row", marginBottom: 12 },
  tabBtn: { flex: 1, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  notificationItem: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: NOTIF_BORDER, marginBottom: 10 },
  notificationText: { marginTop: 6, color: "#666", fontSize: 13 },
  notificationTime: { marginTop: 8, color: "#999", fontSize: 12 },
  calendarBox: { width: "90%", backgroundColor: "#fff", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: BORDER_LIGHT, alignSelf: 'center' },
  calendarHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, alignItems: 'center' },
  calendarNavBtn: { padding: 8 },
  calendarDaysRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 8 },
  calendarDayName: { width: 30, height: 30, justifyContent: "center", alignItems: "center" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarDay: { width: "14.28%", height: 35, justifyContent: "center", alignItems: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center" },
  detailModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    maxHeight: "80%",
  },
  detailModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
  },
  closeButton: {
    padding: 4,
  },
  detailModalBody: {
    marginBottom: 20,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  detailDescription: {
    fontSize: 15,
    color: "#4b5563",
    lineHeight: 22,
  },
  okButton: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  okButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
