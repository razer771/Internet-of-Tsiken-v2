import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import CalendarModal from "../../navigation/CalendarModal";
import GenerateLogReportModal from "./GenerateLogReportModal";
import SuccessModal from "../../navigation/SuccessModal";

const Icon = Feather;

export default function ActivityLogs({ navigation }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [activityLogs, setActivityLogs] = useState([
    { id: 1, date: "01-18-25", time: "9:23 AM", user: "Owner", action: "Activated Sprinkler", description: "Adjusts the water valve in order to keep the brooder clean" },
    { id: 2, date: "01-18-25", time: "9:23 AM", user: "Owner", action: "Activated Sprinkler", description: "Adjusts the water valve in order to keep the brooder clean" },
    { id: 3, date: "01-18-25", time: "9:23 AM", user: "Owner", action: "Activated Sprinkler", description: "Adjusts the water valve in order to keep the brooder clean" },
    { id: 4, date: "01-18-25", time: "9:23 AM", user: "Owner", action: "Activated Sprinkler", description: "Adjusts the water valve in order to keep the brooder clean" },
    { id: 5, date: "01-18-25", time: "9:23 AM", user: "Owner", action: "Activated Sprinkler", description: "Adjusts the water valve in order to keep the brooder clean" },
    { id: 6, date: "01-18-25", time: "9:23 AM", user: "Owner", action: "Activated Sprinkler", description: "Adjusts the water valve in order to keep the brooder clean" },
    { id: 7, date: "01-18-25", time: "9:23 AM", user: "Owner", action: "Activated Sprinkler", description: "Adjusts the water valve in order to keep the brooder clean" },
    { id: 8, date: "01-18-25", time: "9:23 AM", user: "Owner", action: "Activated Sprinkler", description: "Adjusts the water valve in order to keep the brooder clean" },
    { id: 9, date: "01-18-25", time: "9:23 AM", user: "Owner", action: "Activated Sprinkler", description: "Adjusts the water valve in order to keep the brooder clean" },
    { id: 10, date: "01-18-25", time: "9:23 AM", user: "Owner", action: "Activated Sprinkler", description: "Adjusts the water valve in order to keep the brooder clean" },
  ]);

  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}-${day}-${year}`;
  };

  const isSameDate = (dateStr, selectedDate) => {
    if (!selectedDate) return true;
    const [month, day, year] = dateStr.split("-");
    const logDate = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
    return (
      logDate.getFullYear() === selectedDate.getFullYear() &&
      logDate.getMonth() === selectedDate.getMonth() &&
      logDate.getDate() === selectedDate.getDate()
    );
  };

  const filteredLogs = activityLogs.filter((log) => isSameDate(log.date, selectedDate));

  const handleGenerateReport = () => {
    setShowGenerateModal(true);
  };

  const handleCalendarPress = () => {
    setShowCalendar(true);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleClearDateFilter = () => {
    setSelectedDate(null);
  };

  const handleLogGenerated = (logData) => {
    const newLog = {
      id: activityLogs.length + 1,
      date: logData.date,
      time: logData.time,
      user: logData.role,
      action: logData.action,
      description: logData.description,
    };
    setActivityLogs([newLog, ...activityLogs]);
    setShowGenerateModal(false);
    
    // Show success message
    setSuccessMessage("Report successfully generated\nRedirecting to Activity Logs...");
    setShowSuccessModal(true);
    
    console.log("New log added:", newLog);
  };

  const handleSuccessComplete = () => {
    setShowSuccessModal(false);
    setSuccessMessage("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Activity Logs</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={handleGenerateReport}>
            {({ pressed }) => (
              <View style={[styles.generateHeaderButton, pressed && styles.generateHeaderButtonPressed]}>
                <Text style={[styles.generateHeaderText, pressed && styles.generateHeaderTextPressed]}>
                  Generate Log Report
                </Text>
              </View>
            )}
          </Pressable>
          <TouchableOpacity 
            style={[
              styles.calendarButton,
              selectedDate && styles.calendarButtonActive
            ]}
            onPress={handleCalendarPress}
          >
            <Icon 
              name="calendar" 
              size={18} 
              color={selectedDate ? "#ffffff" : "#1a1a1a"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Selected Date Display & Clear Button */}
        {selectedDate && (
          <View style={styles.dateFilterBanner}>
            <View style={styles.dateFilterContent}>
              <Icon name="calendar" size={16} color="#3b82f6" />
              <Text style={styles.dateFilterText}>
                Showing logs for {formatDate(selectedDate)}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={handleClearDateFilter}
              style={styles.clearDateButton}
            >
              <Icon name="x" size={16} color="#64748b" />
              <Text style={styles.clearDateText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDate]}>Date</Text>
            <Text style={[styles.tableHeaderText, styles.colTime]}>Time</Text>
            <Text style={[styles.tableHeaderText, styles.colUser]}>User</Text>
            <Text style={[styles.tableHeaderText, styles.colAction]}>Action</Text>
            <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
          </View>

          {/* Table Rows */}
          {filteredLogs.map((log) => (
            <View key={log.id} style={styles.tableRow}>
              <Text style={[styles.tableCellText, styles.colDate]}>{log.date}</Text>
              <Text style={[styles.tableCellText, styles.colTime]}>{log.time}</Text>
              <Text style={[styles.tableCellText, styles.colUser]}>{log.user}</Text>
              <Text style={[styles.tableCellText, styles.colAction]}>{log.action}</Text>
              <Text style={[styles.tableCellText, styles.colDescription]}>{log.description}</Text>
            </View>
          ))}

          {/* Empty State */}
          {filteredLogs.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No logs found</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Calendar Modal */}
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelectDate={handleDateSelect}
      />

      {/* Generate Log Report Modal */}
      <GenerateLogReportModal
        visible={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleLogGenerated}
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        message={successMessage}
        onComplete={handleSuccessComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#f8fafc",
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  generateHeaderButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1a1a1a",
  },
  generateHeaderButtonPressed: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  generateHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  generateHeaderTextPressed: {
    color: "#ffffff",
  },
  calendarButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  calendarButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  dateFilterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  dateFilterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateFilterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e40af",
  },
  clearDateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearDateText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  tableContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000000",
  },
  colDate: {
    width: 70,
  },
  colTime: {
    width: 70,
  },
  colUser: {
    width: 60,
  },
  colAction: {
    width: 80,
  },
  colDescription: {
    flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "flex-start",
  },
  tableCellText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
});
