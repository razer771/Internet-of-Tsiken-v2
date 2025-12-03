import React, { useState, useEffect } from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
import Header2 from "../navigation/adminHeader";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../config/firebaseconfig";

const COLUMN_WIDTHS = {
  date: 120,
  time: 110,
  user: 150,
  action: 150,
  description: 300,
};
const TABLE_WIDTH =
  COLUMN_WIDTHS.date +
  COLUMN_WIDTHS.time +
  COLUMN_WIDTHS.user +
  COLUMN_WIDTHS.action +
  COLUMN_WIDTHS.description;

export default function ActivityLogs({ navigation }) {
  const [pressedBtn, setPressedBtn] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Fetch all users' activity logs
  useEffect(() => {
    fetchActivityLogs();
  }, []);

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);
      const collections = [
        "addFeedSchedule_logs",
        "deleteFeedSchedule_logs",
        "editFeedSchedule_logs",
        "nightTime_logs",
        "wateringActivity_Logs",
        "predatorDetection_logs",
        "userManagement_logs",
      ];

      // Fetch logs from all collections (all users for admin)
      const allLogsPromises = collections.map(async (collectionName) => {
        const q = query(collection(db, collectionName), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          source: collectionName,
        }));
      });

      const logsArrays = await Promise.all(allLogsPromises);
      const mergedLogs = logsArrays.flat();

      // Sort by timestamp (descending)
      const sortedLogs = mergedLogs.sort((a, b) => {
        let dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        let dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return dateB - dateA;
      });

      setActivityLogs(sortedLogs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Format date to MM/DD/YYYY
  const formatToGMT8Date = (timestamp) => {
    if (!timestamp) return "N/A";
    let date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const month = String(gmt8Date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(gmt8Date.getUTCDate()).padStart(2, "0");
    const year = gmt8Date.getUTCFullYear();
    return `${month}/${day}/${year}`;
  };

  // Format time to HH:MM AM/PM
  const formatToGMT8Time = (timestamp) => {
    if (!timestamp) return "N/A";
    let date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const gmt8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const hours = gmt8Date.getUTCHours();
    const minutes = gmt8Date.getUTCMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  // Filter logs by selected date
  const filteredLogs = selectedDate
    ? activityLogs.filter((log) => {
        const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
        return (
          logDate.getFullYear() === selectedDate.getFullYear() &&
          logDate.getMonth() === selectedDate.getMonth() &&
          logDate.getDate() === selectedDate.getDate()
        );
      })
    : activityLogs;

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateSelect = (day) => {
    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(selected);
    setCalendarVisible(false);
  };

  const handleClearDateFilter = () => {
    setSelectedDate(null);
  };

  const handleQuickSelect = (type) => {
    const today = new Date();
    if (type === "today") {
      setSelectedDate(today);
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (type === "tomorrow") {
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      setSelectedDate(tomorrow);
      setCurrentMonth(new Date(tomorrow.getFullYear(), tomorrow.getMonth(), 1));
    } else if (type === "week") {
      const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
      setSelectedDate(nextWeek);
      setCurrentMonth(new Date(nextWeek.getFullYear(), nextWeek.getMonth(), 1));
    }
  };

  const renderCalendar = () => {
    const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);
    const days = [];
    const today = new Date();
    const isToday = (day) =>
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear() &&
      day === today.getDate();
    
    const isSelected = (day) =>
      selectedDate &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear() &&
      day === selectedDate.getDate();

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isToday(day) && styles.calendarToday,
            isSelected(day) && styles.calendarSelected
          ]}
          onPress={() => handleDateSelect(day)}
        >
          <Text style={[
            styles.calendarDayText,
            (isToday(day) || isSelected(day)) && styles.calendarTodayText
          ]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return days;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#234187" />
          <Text style={styles.loadingText}>Loading activity logs...</Text>
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.pageContent}>
        {/* Buttons Row */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              pressedBtn === "generate" && { backgroundColor: "#133E87", borderColor: "#133E87" }
            ]}
            activeOpacity={0.8}
            onPressIn={() => setPressedBtn("generate")}
            onPressOut={() => setPressedBtn(null)}
            onPress={() => {
              console.log("Navigating to GenerateLogReport");
              navigation.navigate("GenerateLogReport");
            }}
          >
            <Text style={[
              styles.actionButtonText,
              pressedBtn === "generate" && { color: "#fff" }
            ]}>
              Generate Log Report
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconButton,
              pressedBtn === "calendar" && { backgroundColor: "#133E87", borderColor: "#133E87" }
            ]}
            activeOpacity={0.8}
            onPressIn={() => setPressedBtn("calendar")}
            onPressOut={() => setPressedBtn(null)}
            onPress={() => setCalendarVisible(true)}
          >
            <MaterialCommunityIcons
              name="calendar-blank"
              size={20}
              color={pressedBtn === "calendar" ? "#fff" : "#000"}
            />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={styles.title}>Activity Logs</Text>

        {/* Selected Date Display & Clear Button */}
        {selectedDate && (
          <View style={styles.dateFilterBanner}>
            <View style={styles.dateFilterContent}>
              <MaterialCommunityIcons name="calendar" size={16} color="#234187" />
              <Text style={styles.dateFilterText}>
                Showing logs for {selectedDate.toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClearDateFilter} style={styles.clearDateButton}>
              <MaterialCommunityIcons name="close" size={16} color="#64748b" />
              <Text style={styles.clearDateText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Table */}
        <View style={styles.tableCard}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            style={styles.horizontalScroll}
            contentContainerStyle={{ width: TABLE_WIDTH }}
          >
            <View style={[styles.table, { width: TABLE_WIDTH }]}>
              {/* Header */}
              <View style={[styles.row, styles.headerRow]}>
                <View style={[styles.cell, styles.leftCell, { width: COLUMN_WIDTHS.date }]}>
                  <Text style={styles.headerText}>Date</Text>
                </View>
                <View style={[styles.cell, { width: COLUMN_WIDTHS.time }]}>
                  <Text style={styles.headerText}>Time</Text>
                </View>
                <View style={[styles.cell, { width: COLUMN_WIDTHS.user }]}>
                  <Text style={styles.headerText}>User</Text>
                </View>
                <View style={[styles.cell, { width: COLUMN_WIDTHS.action }]}>
                  <Text style={styles.headerText}>Action</Text>
                </View>
                <View style={[styles.cell, styles.rightCell, { width: COLUMN_WIDTHS.description }]}>
                  <Text style={styles.headerText}>Description</Text>
                </View>
              </View>

              {/* Body */}
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, idx) => (
                  <View key={log.id} style={[styles.row, idx % 2 === 1 && styles.altRow]}>
                    <View style={[styles.cell, styles.leftCell, { width: COLUMN_WIDTHS.date }]}>
                      <Text style={[styles.cellText, styles.center]}>{formatToGMT8Date(log.timestamp)}</Text>
                    </View>
                    <View style={[styles.cell, { width: COLUMN_WIDTHS.time }]}>
                      <Text style={[styles.cellText, styles.center]}>{formatToGMT8Time(log.timestamp)}</Text>
                    </View>
                    <View style={[styles.cell, { width: COLUMN_WIDTHS.user }]}>
                      <Text style={[styles.cellText, styles.center]}>
                        {log.firstName && log.lastName
                          ? `${log.firstName} ${log.lastName}`
                          : log.userName || log.userEmail || "N/A"}
                      </Text>
                    </View>
                    <View style={[styles.cell, { width: COLUMN_WIDTHS.action }]}>
                      <Text style={[styles.cellText, styles.center]}>{log.action || "N/A"}</Text>
                    </View>
                    <View style={[styles.cell, styles.rightCell, { width: COLUMN_WIDTHS.description }]}>
                      <Text style={[styles.cellText, styles.center]}>{log.description || "N/A"}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No activity logs found</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
      )}

      {/* Calendar Modal */}
      <Modal
        transparent
        visible={calendarVisible}
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <TouchableOpacity
          style={styles.calendarOverlay}
          activeOpacity={1}
          onPress={() => setCalendarVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.calendarModal}>
            {/* Header */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.calendarArrow}>
                <MaterialCommunityIcons name="chevron-left" size={24} color="#234187" />
              </TouchableOpacity>
              <Text style={styles.calendarMonthYear}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.calendarArrow}>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#234187" />
              </TouchableOpacity>
            </View>

            {/* Day names */}
            <View style={styles.calendarWeekRow}>
              {dayNames.map(day => (
                <View key={day} style={styles.calendarDayName}>
                  <Text style={styles.calendarDayNameText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.calendarGrid}>{renderCalendar()}</View>

            {/* Quick select buttons */}
            <View style={styles.calendarQuickRow}>
              <TouchableOpacity style={styles.calendarQuickBtn} onPress={() => handleQuickSelect("today")}>
                <Text style={styles.calendarQuickText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.calendarQuickBtn} onPress={() => handleQuickSelect("tomorrow")}>
                <Text style={styles.calendarQuickText}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.calendarQuickBtn} onPress={() => handleQuickSelect("week")}>
                <Text style={styles.calendarQuickText}>+1 week</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  pageContent: { paddingVertical: 16, paddingHorizontal: 12 },
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
    marginBottom: 16,
  },
  dateFilterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EBF5FF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateFilterText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#234187",
  },
  clearDateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearDateText: {
    fontSize: 13,
    color: "#64748b",
  },
  actionButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
  },
  iconButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },

  horizontalScroll: { maxHeight: 600 },

  table: {
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },

  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerRow: {
    backgroundColor: "#F7F8FA",
  },
  altRow: {
    backgroundColor: "#FAFBFC",
  },

  cell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    justifyContent: "center",
  },
  leftCell: {
    borderLeftWidth: 0,
  },
  rightCell: {},

  headerText: {
    color: "#000",
    fontWeight: "700",
    textAlign: "center",
  },
  cellText: {
    color: "#000",
    fontSize: 14,
  },
  center: { textAlign: "center" },
  emptyRow: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#666",
    fontStyle: "italic",
  },

  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calendarModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  calendarArrow: {
    padding: 8,
  },
  calendarMonthYear: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  calendarWeekRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  calendarDayName: {
    flex: 1,
    alignItems: "center",
  },
  calendarDayNameText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16, // reduced from 20 to 16
  },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4, // reduced from 8 to 4 for tighter vertical spacing
  },
  calendarDayText: {
    fontSize: 16,
    color: "#333",
  },
  calendarToday: {
    backgroundColor: "#234187",
    borderRadius: 8,
  },
  calendarTodayText: {
    color: "#fff",
    fontWeight: "700",
  },
  calendarQuickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4, // add small top margin for separation from calendar grid
  },
  calendarQuickBtn: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  calendarQuickText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  calendarSelected: {
    backgroundColor: "#133E87",
    borderRadius: 8,
  },
});