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
import GenerateReportModal from "./GenerateReportModal";
import ExportModal from "./ExportModal";
import SuccessModal from "../../navigation/SuccessModal";

const Icon = Feather;

export default function Reports({ navigation }) {
  const [selectedType, setSelectedType] = useState("All");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showOnlyBatch, setShowOnlyBatch] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedReportForExport, setSelectedReportForExport] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState(null); // null means show all dates
  const [reportDate, setReportDate] = useState(new Date()); // for generating new reports

  const [allReports, setAllReports] = useState([
    { id: 1, type: "Batch", date: new Date("2025-10-18"), displayName: "Batch #3" },
    { id: 2, type: "Summary", date: new Date("2025-10-18"), displayName: "Daily Summary" },
    { id: 3, type: "Batch", date: new Date("2025-10-17"), displayName: "Batch #2" },
    { id: 4, type: "Summary", date: new Date("2025-10-17"), displayName: "Daily Summary" },
    { id: 5, type: "Batch", date: new Date("2025-10-16"), displayName: "Batch #1" },
    { id: 6, type: "Summary", date: new Date("2025-10-16"), displayName: "Daily Summary" },
    { id: 7, type: "Report", date: new Date("2025-10-15"), displayName: "Weekly Report" },
  ]);

  // Extract ALL unique batch numbers from reports for duplicate checking
  const existingBatchNumbers = allReports
    .filter(report => report.type === "Batch")
    .map(report => report.displayName);

  const typeOptions = ["All", "Report", "Summary"];

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isSameDate = (date1, date2) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // Filter reports based on Batch button, Type dropdown, and selected calendar date
  const filteredReports = allReports.filter(report => {
    // Date filter - if a date is selected, only show reports from that date
    if (selectedDate && !isSameDate(report.date, selectedDate)) {
      return false;
    }

    // If Batch button is active, only show Batch reports (ignore Type filter)
    if (showOnlyBatch) {
      return report.type === "Batch";
    }
    
    // Otherwise, filter by Type dropdown
    if (selectedType === "All") {
      return true; // Show all reports
    }
    
    return report.type === selectedType; // Show only matching type
  });

  const handleViewReport = (report) => {
    console.log("View report:", report);
    navigation.navigate("ViewReport", { report });
  };

  const handleExport = (report) => {
    console.log("Export report:", report);
    setSelectedReportForExport(report);
    setShowExportModal(true);
  };

  const handleExportType = (type) => {
    console.log(`Exporting as ${type}:`, selectedReportForExport);
    
    // Close export modal
    setShowExportModal(false);
    
    // Show success message
    setSuccessMessage(`Report successfully exported.\nRedirecting to Reports...`);
    setShowSuccessModal(true);
  };

  const handleCalendarPress = () => {
    setShowCalendar(true);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setReportDate(date);
    console.log("Filtering reports for date:", formatDate(date));
  };

  const handleClearDateFilter = () => {
    setSelectedDate(null);
  };

  const handleGenerateReport = () => {
    setShowGenerateModal(true);
  };

  const handleReportGenerated = (reportData) => {
    console.log("New report generated:", reportData);
    
    // Format batch number
    let formattedBatchNumber = reportData.batchNumber.trim();
    
    if (/^\d+$/.test(formattedBatchNumber)) {
      formattedBatchNumber = `Batch #${formattedBatchNumber}`;
    } else if (/^batch\s+\d+$/i.test(formattedBatchNumber)) {
      const num = formattedBatchNumber.match(/\d+/)[0];
      formattedBatchNumber = `Batch #${num}`;
    } else if (/^batch#\d+$/i.test(formattedBatchNumber)) {
      const num = formattedBatchNumber.match(/\d+/)[0];
      formattedBatchNumber = `Batch #${num}`;
    }
    
    const newReport = {
      id: allReports.length + 1,
      type: "Batch",
      date: reportData.batchStartDate,
      displayName: formattedBatchNumber,
      numberOfChicks: reportData.numberOfChicks,
      expectedHarvestDays: reportData.expectedHarvestDays,
      expectedDate: reportData.expectedDate,
    };

    setAllReports([newReport, ...allReports]);
    console.log("Report added to table:", newReport);
    
    // Show success modal
    setSuccessMessage("Report successfully generated\nRedirecting to Reports...");
    setShowSuccessModal(true);
  };

  const handleSuccessComplete = () => {
    setShowSuccessModal(false);
    setSuccessMessage("");
    setSelectedReportForExport(null);
  };

  const handleBatchToggle = () => {
    setShowOnlyBatch(!showOnlyBatch);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>Reports</Text>

        <View style={styles.filtersContainer}>
          {/* Batch Button - Toggle to show only batch reports */}
          <TouchableOpacity 
            style={[
              styles.batchButton,
              showOnlyBatch && styles.batchButtonActive
            ]}
            onPress={handleBatchToggle}
            activeOpacity={1}
          >
            <Text style={[
              styles.batchButtonText,
              showOnlyBatch && styles.batchButtonTextActive
            ]}>
              Batch
            </Text>
          </TouchableOpacity>

          {/* Type Dropdown Button */}
          <View style={styles.typeButtonWrapper}>
            <TouchableOpacity 
              style={[
                styles.typeButton,
                showTypeDropdown && styles.typeButtonActive
              ]}
              onPress={() => setShowTypeDropdown(!showTypeDropdown)}
              activeOpacity={1}
            >
              <Text style={[
                styles.typeButtonText,
                showTypeDropdown && styles.typeButtonTextActive
              ]}>
                Type
              </Text>
              <Icon 
                name="chevron-down" 
                size={14} 
                color={showTypeDropdown ? "#ffffff" : "#1a1a1a"} 
              />
            </TouchableOpacity>

            {/* Type Dropdown Menu */}
            {showTypeDropdown && (
              <View style={styles.dropdown}>
                {typeOptions.map((type, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dropdownOption,
                      index === typeOptions.length - 1 && styles.dropdownOptionLast
                    ]}
                    onPress={() => {
                      setSelectedType(type);
                      setShowTypeDropdown(false);
                      setShowOnlyBatch(false); // Disable batch filter when selecting type
                    }}
                  >
                    <Text style={[
                      styles.dropdownOptionText,
                      selectedType === type && styles.dropdownOptionTextActive
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Calendar Button */}
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
                Showing reports for {formatDate(selectedDate)}
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

        {/* Generate New Report Button */}
        <Pressable
          onPress={handleGenerateReport}
        >
          {({ pressed }) => (
            <View style={[styles.generateButton, pressed && styles.generateButtonPressed]}>
              <Text style={[styles.generateButtonText, pressed && styles.generateButtonTextPressed]}>Generate New Report</Text>
            </View>
          )}
        </Pressable>

        {/* Table Container */}
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.col1]}>Report Type</Text>
            <Text style={[styles.tableHeaderText, styles.col2]}>Date Generated</Text>
            <Text style={[styles.tableHeaderText, styles.col3]}>Actions</Text>
          </View>

          {/* Table Rows */}
          {filteredReports.map((report) => (
            <View key={report.id} style={styles.tableRow}>
              <Text style={[styles.tableCellText, styles.col1]}>{report.displayName}</Text>
              <Text style={[styles.tableCellText, styles.col2]}>{formatDate(report.date)}</Text>
              <View style={[styles.actionsCell, styles.col3]}>
                <Pressable
                  onPress={() => handleViewReport(report)}
                >
                  {({ pressed }) => (
                    <View style={[styles.viewButton, pressed && styles.buttonPressed]}>
                      <Text style={[styles.viewButtonText, pressed && styles.buttonTextPressed]}>View Report</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => handleExport(report)}
                >
                  {({ pressed }) => (
                    <View style={[styles.exportButton, pressed && styles.buttonPressed]}>
                      <Text style={[styles.exportButtonText, pressed && styles.buttonTextPressed]}>Export</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          ))}

          {/* Empty State */}
          {filteredReports.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No reports found</Text>
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

      {/* Generate Report Modal */}
      <GenerateReportModal
        visible={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleReportGenerated}
        existingBatches={existingBatchNumbers}
      />

      {/* Export Modal */}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportType}
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
    zIndex: 10,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  filtersContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  batchButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  batchButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  batchButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  batchButtonTextActive: {
    color: "#ffffff",
  },
  typeButtonWrapper: {
    position: "relative",
    zIndex: 1000,
  },
  typeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 4,
  },
  typeButtonActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  typeButtonTextActive: {
    color: "#ffffff",
  },
  dropdown: {
    position: "absolute",
    top: 38,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minWidth: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  dropdownOptionTextActive: {
    color: "#3b82f6",
    fontWeight: "700",
  },
  calendarButton: {
    width: 32,
    height: 32,
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
  generateButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  generateButtonPressed: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  generateButtonTextPressed: {
    color: "#ffffff",
  },
  tableContainer: {
    marginHorizontal: 16,
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
    fontSize: 13,
    fontWeight: "700",
    color: "#000000",
  },
  col1: {
    flex: 2.5,
  },
  col2: {
    flex: 2.5,
  },
  col3: {
    flex: 3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "center",
  },
  tableCellText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  actionsCell: {
    flexDirection: "column",
    gap: 8,
  },
  viewButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    alignItems: "center",
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  exportButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E8ECF1",
    alignItems: "center",
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  buttonPressed: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  buttonTextPressed: {
    color: "#ffffff",
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
  dateFilterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 12,
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
});
