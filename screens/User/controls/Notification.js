import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import { useNotifications } from "./NotificationContext";

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
      style={[styles.notificationItem, { backgroundColor: item.read ? "#f7f7f7" : "#fff" }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={{ fontWeight: '700' }}>{item.category}: {item.title}</Text>
      <Text style={styles.notificationText}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </Text>
      <Text style={styles.notificationTime}>{item.time}</Text>
    </TouchableOpacity>
  );
}

function NotificationModal({ visible, item, onClose, onMarkRead }) {
  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.notificationModalContent} onPress={(e) => e.stopPropagation()}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={24} color="#222" />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>{item.category}</Text>
          <Text style={styles.modalHeading}>{item.title}</Text>

          <Text style={styles.modalBody}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </Text>

          <Text style={styles.modalTime}>{item.time}</Text>

          <TouchableOpacity 
            style={styles.modalMarkBtn}
            onPress={() => {
              onMarkRead(item.id);
              onClose();
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Mark as read</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function Notification() {
  const [activeTab, setActiveTab] = useState("Daily");
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [markAllClicked, setMarkAllClicked] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const navigation = useNavigation();
  const { notifications, toggleAllRead, markAsRead } = useNotifications();

  const openDrawer = () => setDrawerVisible(true);
  const closeDrawer = () => setDrawerVisible(false);
  const allRead = useMemo(() => notifications.every(n => n.read), [notifications]);

  const handleMarkAll = () => {
    toggleAllRead();
    setMarkAllClicked(true);
  };

  const handleUnreadAll = () => {
    toggleAllRead();
    setMarkAllClicked(false);
  };

  const handleNotificationPress = (id) => {
    const notification = notifications.find(n => n.id === id);
    setSelectedNotification(notification);
    setNotificationModalVisible(true);
  };

  const handleMarkReadFromModal = (id) => {
    markAsRead(id);
    setMarkAllClicked(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.wrapper} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={18} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              onPress={handleMarkAll}
              disabled={markAllClicked}
              style={[styles.markAllBtn, markAllClicked && { backgroundColor: "#ccc", opacity: 0.6 }]
            }
            >
              <Text style={{ marginLeft: 1, color: markAllClicked ? '#999' : '#222' }}>
                Mark all as read
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleUnreadAll}
              disabled={!markAllClicked}
              style={[styles.markAllBtn, !markAllClicked && { backgroundColor: "#ccc", opacity: 0.6 }]
            }
            >
              <Text style={{ marginLeft: 1, color: !markAllClicked ? '#999' : '#222' }}>
                Unread all
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
              onPress={() => handleNotificationPress(n.id)}
            />
          ))}  
        </View>  

        <Modal visible={calendarVisible} transparent animationType="slide">  
          <Pressable style={styles.modalOverlay} onPress={() => setCalendarVisible(false)}>  
            <SmallCalendar onClose={() => setCalendarVisible(false)} />  
          </Pressable>  
        </Modal>

        <NotificationModal 
          visible={notificationModalVisible}
          item={selectedNotification}
          onClose={() => setNotificationModalVisible(false)}
          onMarkRead={handleMarkReadFromModal}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#f7fafc", padding: 16 },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, flexWrap: 'wrap' },
  iconBtn: { height: 36, width: 36, borderRadius: 8, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", marginRight: 8 },
  markAllBtn: { height: 36, paddingHorizontal: 12, borderRadius: 8, flexDirection: "row", alignItems: "center", marginRight: 8, backgroundColor: "#f7fafc" },
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
  notificationModalContent: { width: "85%", backgroundColor: "#fff", borderRadius: 12, padding: 20, alignItems: 'center', left: 30},
  modalCloseBtn: { alignSelf: 'flex-end', padding: 8, marginBottom: 8 },
  modalTitle: { fontSize: 12, color: PRIMARY, fontWeight: '600', marginBottom: 8 },
  modalHeading: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 12, textAlign: 'center' },
  modalBody: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 16, textAlign: 'center' },
  modalTime: { fontSize: 12, color: '#999', marginBottom: 16 },
  modalMarkBtn: { width: "100%", backgroundColor: PRIMARY, paddingVertical: 12, borderRadius: 8, alignItems: 'center' }
});