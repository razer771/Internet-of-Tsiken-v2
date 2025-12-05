import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from "react-native";
import Toast from "../../navigation/Toast";

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
  const [showToast, setShowToast] = useState(false);
  const [errorModal, setErrorModal] = useState({ visible: false, message: "" });

  useEffect(() => {
    setChicksCount(String(initialChicksCount ?? ""));
    setDaysCount(String(initialDaysCount ?? ""));
    setHarvestDays(String(initialHarvestDays ?? ""));
    // Reset toast when modal opens/closes
    setShowToast(false);
  }, [initialChicksCount, initialDaysCount, initialHarvestDays, visible]);

  const handleChicksChange = (text) => {
    // Only allow numeric input, max 3 digits
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length <= 3) {
      setChicksCount(numericText);
    }
  };

  const handleDaysChange = (text) => {
    // Only allow numeric input, max 3 digits
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length <= 3) {
      setDaysCount(numericText);
    }
  };

  const handleHarvestChange = (text) => {
    // Only allow numeric input, max 3 digits
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length <= 3) {
      setHarvestDays(numericText);
    }
  };

  const handleSave = () => {
    // Validate all fields are filled
    if (!chicksCount.trim()) {
      setErrorModal({ visible: true, message: "Please enter the number of chicks" });
      return;
    }
    if (!daysCount.trim()) {
      setErrorModal({ visible: true, message: "Please enter the number of days" });
      return;
    }
    if (!harvestDays.trim()) {
      setErrorModal({ visible: true, message: "Please enter the expected harvest days" });
      return;
    }

    // Validate numeric values
    if (parseInt(chicksCount) <= 0) {
      setErrorModal({ visible: true, message: "Number of chicks must be greater than 0" });
      return;
    }
    if (parseInt(chicksCount) > 999) {
      setErrorModal({ visible: true, message: "Number of chicks cannot exceed 999" });
      return;
    }
    if (parseInt(daysCount) <= 0) {
      setErrorModal({ visible: true, message: "Number of days must be greater than 0" });
      return;
    }
    if (parseInt(daysCount) > 365) {
      setErrorModal({ visible: true, message: "Number of days cannot exceed 365 days" });
      return;
    }
    if (parseInt(harvestDays) <= 0) {
      setErrorModal({ visible: true, message: "Expected harvest days must be greater than 0" });
      return;
    }
    if (parseInt(harvestDays) > 365) {
      setErrorModal({ visible: true, message: "Expected harvest days cannot exceed 365 days" });
      return;
    }

    onSaveChicksCount?.(chicksCount.trim());
    onSaveDaysCount?.(daysCount.trim());
    onSaveHarvestDays?.(harvestDays.trim());
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    setShowToast(false);
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
        <Toast
          visible={showToast}
          message="Chicks count & Days count saved!"
          onHide={() => setShowToast(false)}
        />
        
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
          </View>

          <Pressable onPress={handleSave}>
            {({ pressed }) => (
              <View style={[styles.saveButton, pressed && styles.saveButtonPressed]}>
                <Text style={[styles.saveButtonText, pressed && styles.saveButtonTextPressed]}>
                  Save
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>

        {/* Error Modal */}
        <Modal
          visible={errorModal.visible}
          animationType="fade"
          transparent
          onRequestClose={() => setErrorModal({ visible: false, message: "" })}
        >
          <View style={styles.errorModalBackdrop}>
            <View style={styles.errorModalCard}>
              <Text style={styles.errorModalTitle}>Validation Error</Text>
              <Text style={styles.errorModalMessage}>{errorModal.message}</Text>
              <Pressable
                onPress={() => setErrorModal({ visible: false, message: "" })}
                style={({ pressed }) => [
                  styles.errorModalButton,
                  pressed && styles.errorModalButtonPressed
                ]}
              >
                <Text style={styles.errorModalButtonText}>OK</Text>
              </Pressable>
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
  saveButton: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderColor: "#2563eb",
    borderWidth: 1,
  },
  saveButtonPressed: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  saveButtonText: {
    color: "#000000",
    fontWeight: "600",
  },
  saveButtonTextPressed: {
    color: "#ffffff",
  },
  errorModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  errorModalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  errorModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ef4444",
    marginBottom: 12,
    textAlign: "center",
  },
  errorModalMessage: {
    fontSize: 15,
    color: "#334155",
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 22,
  },
  errorModalButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  errorModalButtonPressed: {
    backgroundColor: "#2563eb",
  },
  errorModalButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});