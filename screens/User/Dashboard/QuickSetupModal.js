import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Image,
} from "react-native";

export default function QuickSetupModal({
  visible,
  initialChicksCount = "",
  initialDaysCount = "",
  initialHarvestDays = "",
  onSaveChicksCount,
  onSaveDaysCount,
  onSaveHarvestDays,
  onClose,
}) {
  const [chicksCount, setChicksCount] = useState(
    String(initialChicksCount ?? "")
  );
  const [daysCount, setDaysCount] = useState(String(initialDaysCount ?? ""));
  const [harvestDays, setHarvestDays] = useState(String(initialHarvestDays ?? ""));
  const [showSuccess, setShowSuccess] = useState(false);
  const [chicksError, setChicksError] = useState("");
  const [daysError, setDaysError] = useState("");
  const [harvestError, setHarvestError] = useState("");

  // Check if all fields are valid and filled
  const isFormValid = chicksCount.trim() !== "" && 
                      daysCount.trim() !== "" && 
                      harvestDays.trim() !== "" &&
                      !chicksError &&
                      !daysError &&
                      !harvestError &&
                      parseInt(chicksCount) > 0 &&
                      parseInt(daysCount) > 0 &&
                      parseInt(harvestDays) > 0;

  useEffect(() => {
    setChicksCount(String(initialChicksCount ?? ""));
    setDaysCount(String(initialDaysCount ?? ""));
    setHarvestDays(String(initialHarvestDays ?? ""));
    // Reset errors when modal opens/closes
    setChicksError("");
    setDaysError("");
    setHarvestError("");
  }, [initialChicksCount, initialDaysCount, initialHarvestDays, visible]);

  const handleChicksChange = (text) => {
    // Only allow numeric input, max 100
    const numericText = text.replace(/[^0-9]/g, '');
    const numValue = parseInt(numericText);
    
    if (numericText === '') {
      setChicksCount(numericText);
      setChicksError("");
    } else if (numValue >= 0 && numValue <= 100) {
      setChicksCount(numericText);
      setChicksError("");
    } else {
      setChicksError("Number of chicks cannot exceed 100");
    }
  };

  const handleDaysChange = (text) => {
    // Only allow numeric input, max 365
    const numericText = text.replace(/[^0-9]/g, '');
    const numValue = parseInt(numericText);
    
    if (numericText === '') {
      setDaysCount(numericText);
      setDaysError("");
    } else if (numValue >= 0 && numValue <= 365) {
      setDaysCount(numericText);
      setDaysError("");
    } else {
      setDaysError("Number of days cannot exceed 365");
    }
  };

  const handleHarvestChange = (text) => {
    // Only allow numeric input, max 365
    const numericText = text.replace(/[^0-9]/g, '');
    const numValue = parseInt(numericText);
    
    if (numericText === '') {
      setHarvestDays(numericText);
      setHarvestError("");
    } else if (numValue >= 0 && numValue <= 365) {
      setHarvestDays(numericText);
      setHarvestError("");
    } else {
      setHarvestError("Expected harvest days cannot exceed 365");
    }
  };

  const handleSave = () => {
    onSaveChicksCount?.(chicksCount.trim());
    onSaveDaysCount?.(daysCount.trim());
    onSaveHarvestDays?.(harvestDays.trim());
    
    // Show success modal
    setShowSuccess(true);
    
    // Close after 2 seconds without clearing the form
    // Form will be populated with saved values when reopened
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable 
        style={styles.backdrop} 
        onPress={handleClose}
        activeOpacity={1}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Close Button X */}
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Quick Overview Setup</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Chicks </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter number of chicks"
              placeholderTextColor="#9ca3af"
              value={chicksCount}
              onChangeText={handleChicksChange}
              keyboardType="numeric"
            />
            {chicksError ? <Text style={styles.errorText}>{chicksError}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Days</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter number of days (-45)"
              placeholderTextColor="#9ca3af"
              value={daysCount}
              onChangeText={handleDaysChange}
              keyboardType="numeric"
            />
            {daysError ? <Text style={styles.errorText}>{daysError}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Expected Harvest (days)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter harvest days"
              placeholderTextColor="#9ca3af"
              value={harvestDays}
              onChangeText={handleHarvestChange}
              keyboardType="numeric"
            />
            {harvestError ? <Text style={styles.errorText}>{harvestError}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, !isFormValid && styles.saveButtonDisabled]}
            activeOpacity={0.9}
            onPress={handleSave}
            disabled={!isFormValid}
          >
            <Text style={[styles.saveButtonText, !isFormValid && styles.saveButtonTextDisabled]}>Save</Text>
          </TouchableOpacity>
        </Pressable>

        {/* Success Modal */}
        <Modal visible={showSuccess} transparent animationType="fade">
          <View style={styles.successModalOverlay}>
            <View style={styles.successModalCard}>
              <Image 
                source={{ uri: 'https://img.icons8.com/color/96/checked--v1.png' }} 
                style={styles.successIcon} 
              />
              <Text style={styles.successTitle}>Successfully Saved!</Text>
            </View>
          </View>
        </Modal>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "90%",
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 20,
    color: "#64748b",
    fontWeight: "400",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#0f172a",
    paddingRight: 40,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#000000ff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: "#154b99",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderColor: "#2563eb",
    borderWidth: 1,
  },
  saveButtonDisabled: {
    backgroundColor: "#9ca3af",
    borderColor: "#9ca3af",
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  saveButtonTextDisabled: {
    color: "#e5e7eb",
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModalCard: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
  },
  successIcon: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2E7D32",
  },
});