import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Pressable,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useNotifications } from "./NotificationContext";

const PRIMARY = "#133E87";
const BORDER_LIGHT = "rgba(0,0,0,0.12)";
const NOTIF_BORDER = "rgba(0,0,0,0.1)";

const TimePeriod = ["Daily", "Weekly", "Monthly"];

// Manual date parser — Hermes JS engine does NOT support new Date("Month D, YYYY")
const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function parseNotifDate(timeStr) {
  if (!timeStr) return null;

  // Handle format: "3/13/2026, 6:00:00 AM"
  const match = timeStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const month = parseInt(match[1], 10) - 1; // months are 0-indexed
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    return new Date(year, month, day);
  }

  // Fallback: old format "Month D, YYYY (HH:MM AM/PM)"
  const match2 = timeStr.match(/^(\w+)\s+(\d+),\s+(\d{4})/);
  if (match2) {
    const month = MONTHS[match2[1].toLowerCase()];
    const day = parseInt(match2[2], 10);
    const year = parseInt(match2[3], 10);
    if (month === undefined || isNaN(day) || isNaN(year)) return null;
    return new Date(year, month, day);
  }

  return null;
}

function SmallCalendar({ onClose, selectedDate }) {
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);

  const base = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [monthOffset]);

  const monthName = new Date(base.year, base.month).toLocaleString(undefined, {
    month: "long",
  });

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
    return (
      base.year === now.getFullYear() &&
      base.month === now.getMonth() &&
      d === now.getDate()
    );
  };

  const isSelected = (d) => {
    if (!d || !selectedDate) return false;
    return (
      base.year === selectedDate.getFullYear() &&
      base.month === selectedDate.getMonth() &&
      d === selectedDate.getDate()
    );
  };

  const isFutureDate = (d) => {
    if (!d) return false;
    const now = new Date();
    // Normalize to compare dates without time components
    const dateToCheck = new Date(base.year, base.month, d);
    const todayDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    return dateToCheck > todayDate;
  };

  return (
    <View style={styles.calendarBox}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          onPress={() => setMonthOffset((m) => m - 1)}
          style={styles.calendarNavBtn}
        >
          <Ionicons name="chevron-back" size={20} color="#222" />
        </TouchableOpacity>
        <Text style={{ fontWeight: "600" }}>
          {monthName} {base.year}
        </Text>
        <TouchableOpacity
          onPress={() => setMonthOffset((m) => m + 1)}
          style={styles.calendarNavBtn}
        >
          <Ionicons name="chevron-forward" size={20} color="#222" />
        </TouchableOpacity>
      </View>

      <View style={styles.calendarDaysRow}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <View key={d} style={styles.calendarDayName}>
            <Text>{d}</Text>
          </View>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {grid.map((item, idx) => {
          const selected = isSelected(item);
          const todayDay = isToday(item);
          const isFuture = isFutureDate(item);
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.calendarDay,
                todayDay && { backgroundColor: "#e0e7ff" },
                selected && { backgroundColor: PRIMARY },
                isFuture && { opacity: 0.4 },
              ]}
              onPress={() => {
                if (!item || isFuture) return;
                const picked = new Date(base.year, base.month, item);
                onClose(picked);
              }}
              disabled={!item || isFuture}
            >
              <Text
                style={{
                  color: selected ? "#fff" : todayDay ? PRIMARY : "#222",
                  fontWeight: selected || todayDay ? "700" : "400",
                }}
              >
                {item || ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function NotificationItem({ item, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        { backgroundColor: item.read ? "#e5e7eb" : "#fff" },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={{ fontWeight: "700", color: item.read ? "#6b7280" : "#000" }}
      >
        {item.category}: {item.title}
      </Text>
      <Text
        style={[
          styles.notificationText,
          { color: item.read ? "#9ca3af" : "#666" },
        ]}
      >
        {item.description ||
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit."}
      </Text>
      <Text
        style={[
          styles.notificationTime,
          { color: item.read ? "#9ca3af" : "#999" },
        ]}
      >
        {item.time}
      </Text>
    </TouchableOpacity>
  );
}

export default function Notification() {
  const [activeTab, setActiveTab] = useState("Daily");
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const navigation = useNavigation();
  const { notifications, toggleAllRead, markAsRead } = useNotifications();

  const allRead = useMemo(
    () => notifications.every((n) => n.read),
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const notifDate = parseNotifDate(n.time);
      if (!notifDate) return true;

      // If a specific date is picked, only show that exact date (ignore tab)
      if (selectedDate) {
        return (
          notifDate.getFullYear() === selectedDate.getFullYear() &&
          notifDate.getMonth() === selectedDate.getMonth() &&
          notifDate.getDate() === selectedDate.getDate()
        );
      }

      // Otherwise filter by tab period relative to today
      const now = new Date();
      if (activeTab === "Daily") {
        return (
          notifDate.getFullYear() === now.getFullYear() &&
          notifDate.getMonth() === now.getMonth() &&
          notifDate.getDate() === now.getDate()
        );
      } else if (activeTab === "Weekly") {
        const msPerDay = 86400000;
        const diffDays = Math.floor((now - notifDate) / msPerDay);
        return diffDays >= 0 && diffDays < 7;
      } else if (activeTab === "Monthly") {
        return (
          notifDate.getFullYear() === now.getFullYear() &&
          notifDate.getMonth() === now.getMonth()
        );
      }
      return true;
    });
  }, [notifications, activeTab, selectedDate]);

  const handleNotificationPress = (notification) => {
    markAsRead(notification.id);
    setSelectedNotification(notification);
    setDetailModalVisible(true);
  };

  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedNotification(null);
  };

  const handleCalendarClose = (date) => {
    setCalendarVisible(false);
    // Only set date if it's not in the future
    if (date) {
      const now = new Date();
      const todayDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const selectedDateNormalized = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      if (selectedDateNormalized <= todayDate) {
        setSelectedDate(date);
      }
    }
  };

  const clearDateFilter = () => setSelectedDate(null);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        style={styles.wrapper}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={18} />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={toggleAllRead}
              style={[
                styles.markAllBtn,
                allRead && { backgroundColor: PRIMARY },
              ]}
            >
              <Ionicons
                name="mail-unread-outline"
                size={16}
                color={allRead ? "#fff" : "#222"}
              />
              <Text style={{ marginLeft: 8, color: allRead ? "#fff" : "#222" }}>
                Mark all as read
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCalendarVisible(true)}
              style={[
                styles.iconBtn,
                {
                  marginLeft: 8,
                  backgroundColor: selectedDate ? PRIMARY : "#fff",
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={selectedDate ? "#fff" : "#222"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Active date filter badge */}
        {selectedDate && (
          <View style={styles.dateFilterBadge}>
            <Ionicons name="calendar" size={14} color={PRIMARY} />
            <Text style={styles.dateFilterText}>
              {selectedDate.toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
            <TouchableOpacity
              onPress={clearDateFilter}
              style={{ marginLeft: 6 }}
            >
              <Ionicons name="close-circle" size={16} color={PRIMARY} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tabs}>
          {TimePeriod.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => {
                setActiveTab(p);
                setSelectedDate(null);
              }}
              style={[
                styles.tabBtn,
                activeTab === p &&
                  !selectedDate && { backgroundColor: PRIMARY },
              ]}
            >
              <Text
                style={{
                  color: activeTab === p && !selectedDate ? "#fff" : PRIMARY,
                }}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View>
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="notifications-off-outline"
                size={40}
                color="#9ca3af"
              />
              <Text style={styles.emptyStateText}>
                No notifications for this period
              </Text>
            </View>
          ) : (
            filteredNotifications.map((n) => (
              <NotificationItem
                key={n.id}
                item={n}
                onPress={() => handleNotificationPress(n)}
              />
            ))
          )}
        </View>

        {/* Calendar Modal */}
        <Modal visible={calendarVisible} transparent animationType="slide">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setCalendarVisible(false)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <SmallCalendar
                onClose={handleCalendarClose}
                selectedDate={selectedDate}
              />
            </Pressable>
          </Pressable>
        </Modal>

        {/* Notification Detail Modal */}
        <Modal visible={detailModalVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={closeDetailModal}>
            <Pressable
              style={styles.detailModalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.detailModalHeader}>
                <Text style={styles.detailModalTitle}>
                  Notification Details
                </Text>
                <TouchableOpacity
                  onPress={closeDetailModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {selectedNotification && (
                <View style={styles.detailModalBody}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>
                      {selectedNotification.category}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Title</Text>
                    <Text style={styles.detailValue}>
                      {selectedNotification.title}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailDescription}>
                      {selectedNotification.description ||
                        "Lorem ipsum dolor sit amet, consectetur adipiscing elit."}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Time</Text>
                    <Text style={styles.detailValue}>
                      {selectedNotification.time}
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                onPress={closeDetailModal}
                style={styles.okButton}
              >
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  iconBtn: {
    height: 36,
    width: 36,
    borderRadius: 8,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  markAllBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    backgroundColor: "#f7fafc",
  },
  tabs: { flexDirection: "row", marginBottom: 12 },
  tabBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  notificationItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NOTIF_BORDER,
    marginBottom: 10,
  },
  notificationText: { marginTop: 6, color: "#666", fontSize: 13 },
  notificationTime: { marginTop: 8, color: "#999", fontSize: 12 },
  calendarBox: {
    width: "90%",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    alignSelf: "center",
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    alignItems: "center",
  },
  calendarNavBtn: { padding: 8 },
  calendarDaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  calendarDayName: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarDay: {
    width: "14.28%",
    height: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
  },
  dateFilterBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  dateFilterText: {
    color: PRIMARY,
    fontWeight: "600",
    fontSize: 13,
    marginLeft: 6,
  },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyStateText: { marginTop: 12, color: "#9ca3af", fontSize: 15 },
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
  detailModalTitle: { fontSize: 20, fontWeight: "700", color: "#1f2937" },
  closeButton: { padding: 4 },
  detailModalBody: { marginBottom: 20 },
  detailRow: { marginBottom: 16 },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  detailValue: { fontSize: 16, fontWeight: "600", color: "#1f2937" },
  detailDescription: { fontSize: 15, color: "#4b5563", lineHeight: 22 },
  okButton: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  okButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
