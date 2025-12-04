import React, { useState } from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import Header2 from "./adminHeader";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

const COLUMN_WIDTHS = {
  date: 100,
  time: 110,
  role: 110,
  action: 150,
  description: 320,
};
const TABLE_WIDTH =
  COLUMN_WIDTHS.date +
  COLUMN_WIDTHS.time +
  COLUMN_WIDTHS.role +
  COLUMN_WIDTHS.action +
  COLUMN_WIDTHS.description;

const logs = Array.from({ length: 12 }).map((_, i) => ({
  id: i + 1,
  date: "10 18 25",
  time: "10:23 AM",
  role: "Owner",
  action: "Activated\nSprinkler",
  description:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
}));

export default function ActivityLogs({ navigation }) { // Make sure navigation prop is here
  const [pressedBtn, setPressedBtn] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

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
              console.log("Navigating to GenerateLogReport"); // Debug log
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
              color={pressedBtn === "calendar" ? "#fff" : "#000"} // changed from "#234187" to "#000"
            />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={styles.title}>Activity Logs</Text>

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
                <View style={[styles.cell, { width: COLUMN_WIDTHS.role }]}>
                  <Text style={styles.headerText}>Role</Text>
                </View>
                <View style={[styles.cell, { width: COLUMN_WIDTHS.action }]}>
                  <Text style={styles.headerText}>Action</Text>
                </View>
                <View style={[styles.cell, styles.rightCell, { width: COLUMN_WIDTHS.description }]}>
                  <Text style={styles.headerText}>Description</Text>
                </View>
              </View>

              {/* Body */}
              {logs.map((log, idx) => (
                <View key={log.id} style={[styles.row, idx % 2 === 1 && styles.altRow]}>
                  <View style={[styles.cell, styles.leftCell, { width: COLUMN_WIDTHS.date }]}>
                    <Text style={[styles.cellText, styles.center]}>{log.date}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLUMN_WIDTHS.time }]}>
                    <Text style={[styles.cellText, styles.center]}>{log.time}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLUMN_WIDTHS.role }]}>
                    <Text style={[styles.cellText, styles.center]}>{log.role}</Text>
                  </View>
                  <View style={[styles.cell, { width: COLUMN_WIDTHS.action }]}>
                    <Text style={[styles.cellText, styles.center]}>{log.action}</Text>
                  </View>
                  <View style={[styles.cell, styles.rightCell, { width: COLUMN_WIDTHS.description }]}>
                    <Text style={[styles.cellText, styles.center]}>{log.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

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
  pageContent: { paddingVertical: 16, paddingHorizontal: 12 },
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 16, // increased spacing
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
    marginBottom: 16, // increased spacing below title
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