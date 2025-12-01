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
  onSaveChicksCount,
  onSaveDaysCount,
  onClose,
}) {
  const [chicksCount, setChicksCount] = useState(
    String(initialChicksCount ?? "")
  );
  const [daysCount, setDaysCount] = useState(String(initialDaysCount ?? ""));
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    setChicksCount(String(initialChicksCount ?? ""));
    setDaysCount(String(initialDaysCount ?? ""));
    // Reset toast when modal opens/closes
    setShowToast(false);
  }, [initialChicksCount, initialDaysCount, visible]);

  const handleSave = () => {
    onSaveChicksCount?.(chicksCount.trim());
    onSaveDaysCount?.(daysCount.trim());
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
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Close Button X */}
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Quick Overview Setup</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Chicks per Batch</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter number of chicks"
              placeholderTextColor="#9ca3af"
              value={chicksCount}
              onChangeText={setChicksCount}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of Days per Batch</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter number of days (-45)"
              placeholderTextColor="#9ca3af"
              value={daysCount}
              onChangeText={setDaysCount}
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
        </View>

        <Toast
          visible={showToast}
          message="Chicks count & Days count saved!"
          onHide={() => setShowToast(false)}
        />
      </View>
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
    borderColor: "#3b82f6",
    borderWidth: 1,
  },
  saveButtonPressed: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  saveButtonText: {
    color: "#000000",
    fontWeight: "600",
  },
  saveButtonTextPressed: {
    color: "#ffffff",
  },
});