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
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  useEffect(() => {
    setChicksCount(String(initialChicksCount ?? ""));
    setDaysCount(String(initialDaysCount ?? ""));
    // Reset toast when modal opens/closes
    setShowToast(false);
  }, [initialChicksCount, initialDaysCount, visible]);

  const handleChicksChange = (text) => {
    // Only allow numeric input
    const numericText = text.replace(/[^0-9]/g, '');
    setChicksCount(numericText);
  };

  const handleDaysChange = (text) => {
    // Only allow numeric input
    const numericText = text.replace(/[^0-9]/g, '');
    setDaysCount(numericText);
  };

  const handleSave = () => {
    // Validate that both fields have values
    if (!chicksCount.trim() || !daysCount.trim()) {
      return; // Don't proceed if either field is empty
    }
    
    onSaveChicksCount?.(chicksCount.trim());
    onSaveDaysCount?.(daysCount.trim());
    
    // Show saved popup
    setShowSavedPopup(true);
    setTimeout(() => {
      setShowSavedPopup(false);
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

          <TouchableOpacity 
            style={[
              styles.saveButton,
              (!chicksCount.trim() || !daysCount.trim()) && styles.saveButtonDisabled
            ]}
            activeOpacity={0.9}
            onPress={handleSave}
            disabled={!chicksCount.trim() || !daysCount.trim()}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>

      {/* Save popup */}
      <Modal
        key="savePopupModal"
        visible={showSavedPopup}
        transparent
        animationType="fade"
      >
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Image
              source={require("../../../assets/logo.png")}
              style={{ width: 56, height: 56 }}
            />
            <Text style={styles.popupText}>Saved Successfully!</Text>
          </View>
        </View>
      </Modal>
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
    backgroundColor: "#154b99",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 135,
    alignItems: "center",
    alignSelf: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#94a3b8",
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  popupBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  popupText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#22c55e",
    marginTop: 10,
  },
});