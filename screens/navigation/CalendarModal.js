import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";

const Icon = Feather;

export default function CalendarModal({ visible, onClose, onSelectDate }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    onSelectDate(date);
    onClose();
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.calendarContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Date</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="x" size={24} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.arrowButton}>
              <Icon name="chevron-left" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.arrowButton}>
              <Icon name="chevron-right" size={24} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekDays}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, index) => (
              <Text key={index} style={styles.weekDayText}>{day}</Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {days.map((date, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayButton,
                  !date && styles.emptyDay,
                  date && isToday(date) && styles.todayButton,
                  date && isSelected(date) && styles.selectedButton,
                ]}
                onPress={() => date && handleSelectDate(date)}
                disabled={!date}
              >
                {date && (
                  <Text style={[
                    styles.dayText,
                    isToday(date) && styles.todayText,
                    isSelected(date) && styles.selectedText,
                  ]}>
                    {date.getDate()}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarContainer: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeButton: {
    padding: 4,
  },
  monthSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  arrowButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  weekDays: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayButton: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 2,
  },
  emptyDay: {
    backgroundColor: "transparent",
  },
  todayButton: {
    backgroundColor: "#dbeafe",
    borderRadius: 8,
  },
  selectedButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  todayText: {
    color: "#3b82f6",
    fontWeight: "700",
  },
  selectedText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
