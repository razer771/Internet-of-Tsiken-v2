import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";

const Icon = Feather;

export default function ExportModal({ visible, onClose, onExport }) {
  const handleExportPDF = () => {
    console.log("Exporting as PDF");
    onExport("PDF");
  };

  const handleExportExcel = () => {
    console.log("Exporting as Excel");
    onExport("Excel");
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Export As</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="x" size={24} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          {/* Export Options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleExportPDF}
              activeOpacity={0.7}
            >
              <Icon name="file-text" size={24} color="#ef4444" />
              <Text style={styles.optionText}>PDF</Text>
              <Icon name="chevron-right" size={20} color="#64748b" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleExportExcel}
              activeOpacity={0.7}
            >
              <Icon name="file" size={24} color="#22c55e" />
              <Text style={styles.optionText}>Excel</Text>
              <Icon name="chevron-right" size={20} color="#64748b" />
            </TouchableOpacity>
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
  container: {
    width: "85%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    padding: 8,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 16,
  },
});
