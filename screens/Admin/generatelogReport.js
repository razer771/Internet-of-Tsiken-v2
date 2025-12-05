import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import Header2 from "../navigation/adminHeader";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

const Logo = require("../../assets/logo.png");

export default function GenerateLogReport({ route, navigation }) {
  const { exportData, totalLogs, filters, onExportPDF } = route.params || {};
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [exporting, setExporting] = useState(false);

  if (!exportData || exportData.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header2 />
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={80}
            color="#ccc"
          />
          <Text style={styles.emptyText}>No data to preview</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentPage = exportData[currentPageIndex];

  const handleExportPDF = async () => {
    if (onExportPDF) {
      setExporting(true);
      try {
        await onExportPDF();
      } catch (error) {
        console.error("Error exporting PDF:", error);
      } finally {
        setExporting(false);
      }
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < exportData.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Section with Logo and Company Info */}
        <View style={styles.headerSection}>
          <Image source={Logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.companyName}>Smart Brooder Systems Inc.</Text>
          <Text style={styles.reportTitle}>Activity Logs Report</Text>
          <View style={styles.filterSummary}>
            <Text style={styles.filterText}>
              <Text style={styles.filterLabel}>Filter Applied: </Text>
              Name: {filters?.name || "All"}
            </Text>
            <Text style={styles.filterText}>
              Date Range: {filters?.startDate || "None"} -{" "}
              {filters?.endDate || "None"}
            </Text>
            <Text style={styles.filterText}>Total Logs: {totalLogs || 0}</Text>
          </View>
        </View>

        {/* Export Button */}
        <TouchableOpacity
          style={[
            styles.exportButton,
            exporting && styles.exportButtonDisabled,
          ]}
          onPress={handleExportPDF}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="file-pdf-box"
                size={20}
                color="#fff"
              />
              <Text style={styles.exportButtonText}>Export to PDF</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Page Navigation */}
        {exportData.length > 1 && (
          <View style={styles.pageNavigationTop}>
            <TouchableOpacity
              style={[
                styles.pageNavButton,
                currentPageIndex === 0 && styles.pageNavButtonDisabled,
              ]}
              onPress={handlePrevPage}
              disabled={currentPageIndex === 0}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={20}
                color={currentPageIndex === 0 ? "#ccc" : "#133E87"}
              />
              <Text
                style={[
                  styles.pageNavButtonText,
                  currentPageIndex === 0 && styles.pageNavButtonTextDisabled,
                ]}
              >
                Previous
              </Text>
            </TouchableOpacity>

            <Text style={styles.pageInfo}>
              Page {currentPageIndex + 1} of {exportData.length}
            </Text>

            <TouchableOpacity
              style={[
                styles.pageNavButton,
                currentPageIndex === exportData.length - 1 &&
                  styles.pageNavButtonDisabled,
              ]}
              onPress={handleNextPage}
              disabled={currentPageIndex === exportData.length - 1}
            >
              <Text
                style={[
                  styles.pageNavButtonText,
                  currentPageIndex === exportData.length - 1 &&
                    styles.pageNavButtonTextDisabled,
                ]}
              >
                Next
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={
                  currentPageIndex === exportData.length - 1
                    ? "#ccc"
                    : "#133E87"
                }
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Table Preview */}
        <View style={styles.tableContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              {/* Table Header */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={[styles.tableCell, styles.cellNo]}>
                  <Text style={styles.headerText}>No</Text>
                </View>
                <View style={[styles.tableCell, styles.cellDate]}>
                  <Text style={styles.headerText}>Date</Text>
                </View>
                <View style={[styles.tableCell, styles.cellTime]}>
                  <Text style={styles.headerText}>Time</Text>
                </View>
                <View style={[styles.tableCell, styles.cellName]}>
                  <Text style={styles.headerText}>Name</Text>
                </View>
                <View style={[styles.tableCell, styles.cellRole]}>
                  <Text style={styles.headerText}>Role</Text>
                </View>
                <View style={[styles.tableCell, styles.cellAction]}>
                  <Text style={styles.headerText}>Action</Text>
                </View>
                <View style={[styles.tableCell, styles.cellDescription]}>
                  <Text style={styles.headerText}>Description</Text>
                </View>
              </View>

              {/* Table Body */}
              {currentPage.entries.map((entry, index) => (
                <View
                  key={index}
                  style={[
                    styles.tableRow,
                    index % 2 === 0 && styles.tableRowEven,
                  ]}
                >
                  <View style={[styles.tableCell, styles.cellNo]}>
                    <Text style={styles.cellText}>{entry.No}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.cellDate]}>
                    <Text style={styles.cellText}>{entry.Date}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.cellTime]}>
                    <Text style={styles.cellText}>{entry.Time}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.cellName]}>
                    <Text style={styles.cellText}>{entry.Name}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.cellRole]}>
                    <Text style={styles.cellText}>{entry.Role}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.cellAction]}>
                    <Text style={styles.cellText}>{entry.Action}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.cellDescription]}>
                    <Text style={styles.cellText}>{entry.Description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Page Info at Bottom */}
        <View style={styles.pageInfoBottom}>
          <Text style={styles.pageInfoText}>
            Showing {currentPage.entriesCount} entries on this page
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    padding: 16,
  },
  headerSection: {
    alignItems: "center",
    paddingVertical: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#133E87",
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 12,
    borderRadius: 50,
  },
  companyName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#133E87",
    marginBottom: 8,
    textAlign: "center",
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  filterSummary: {
    backgroundColor: "#F7F9FB",
    padding: 16,
    borderRadius: 8,
    width: "100%",
    marginTop: 8,
  },
  filterText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  filterLabel: {
    fontWeight: "600",
    color: "#333",
  },
  exportButton: {
    backgroundColor: "#133E87",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
    shadowColor: "#133E87",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exportButtonDisabled: {
    backgroundColor: "#8A99A8",
    shadowOpacity: 0,
    elevation: 0,
  },
  exportButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  pageNavigationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  pageNavButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  pageNavButtonDisabled: {
    backgroundColor: "#F7F8FA",
    borderColor: "#E5E7EB",
  },
  pageNavButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#133E87",
  },
  pageNavButtonTextDisabled: {
    color: "#ccc",
  },
  pageInfo: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableHeader: {
    backgroundColor: "#133E87",
  },
  tableRowEven: {
    backgroundColor: "#F9FAFB",
  },
  tableCell: {
    padding: 12,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  cellNo: {
    width: 50,
  },
  cellDate: {
    width: 110,
  },
  cellTime: {
    width: 90,
  },
  cellName: {
    width: 150,
  },
  cellRole: {
    width: 100,
  },
  cellAction: {
    width: 140,
  },
  cellDescription: {
    width: 250,
  },
  headerText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  cellText: {
    color: "#333",
    fontSize: 13,
    textAlign: "center",
  },
  pageInfoBottom: {
    marginTop: 16,
    alignItems: "center",
  },
  pageInfoText: {
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    color: "#999",
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: "#133E87",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
