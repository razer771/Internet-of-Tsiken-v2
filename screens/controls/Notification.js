import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import Header from "../navigation/Header";
import SideNavigation from "../navigation/SideNavigation";
import BottomNavigation from "../navigation/BottomNavigation";
import { useNavigation } from '@react-navigation/native';

const PRIMARY = "#133E87";
const BORDER_LIGHT = "rgba(0,0,0,0.12)";
const NOTIF_BORDER = "rgba(0,0,0,0.1)";

const initialNotifications = [
  { id: 1, category: "IoT: Internet of Tsiken", title: "Temperature too high/low", time: "October 21, 2025 (09:19 PM)", read: false },
  { id: 2, category: "IoT: Internet of Tsiken", title: "Feeder empty", time: "October 21, 2025 (09:19 PM)", read: false },
  { id: 3, category: "IoT: Internet of Tsiken", title: "Water low", time: "October 21, 2025 (09:19 PM)", read: true },
  { id: 4, category: "IoT: Internet of Tsiken", title: "Switched to Solar Mode", time: "October 21, 2025 (09:19 PM)", read: true },
  { id: 5, category: "IoT: Internet of Tsiken", title: "Power outage", time: "October 21, 2025 (09:19 PM)", read: false },
];

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

function NotificationItem({ item }) {
  return (
    <View style={[styles.notificationItem, { backgroundColor: item.read ? "#f7f7f7" : "#fff" }]}>
      <Text style={{ fontWeight: '700' }}>{item.category}: {item.title}</Text>
      <Text style={styles.notificationText}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </Text>
      <Text style={styles.notificationTime}>{item.time}</Text>
    </View>
  );
}

export default function Notification() {
  const [activeTab, setActiveTab] = useState("Daily");
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const navigation = useNavigation();

  const openDrawer = () => setDrawerVisible(true);
  const closeDrawer = () => setDrawerVisible(false);
  const allRead = useMemo(() => notifications.every(n => n.read), [notifications]);

  const toggleMarkAll = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: !allRead })));
  };

  return (
    <View style={{ flex: 1 }}>
      <Header onOpenMenu={openDrawer} navigation={navigation} />
      <SideNavigation visible={drawerVisible} onClose={closeDrawer} navigation={navigation} />

      <ScrollView style={styles.wrapper} contentContainerStyle={{ paddingBottom: 90 }}>
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
          {notifications.map(n => <NotificationItem key={n.id} item={n} />)}  
        </View>  

        <Modal visible={calendarVisible} transparent animationType="slide">  
          <Pressable style={styles.modalOverlay} onPress={() => setCalendarVisible(false)}>  
            <SmallCalendar onClose={() => setCalendarVisible(false)} />  
          </Pressable>  
        </Modal>  
      </ScrollView>

      <BottomNavigation 
        active="Control" 
        onNavigate={(screen) => navigation.navigate(screen)} 
      />
    </View>
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center" }
});