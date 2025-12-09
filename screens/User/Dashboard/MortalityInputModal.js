import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import CalendarModal from "../../navigation/CalendarModal";
import { db, auth } from "../../../config/firebaseconfig";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";

const Icon = Feather;

export default function MortalityInputModal({
  visible,
  onClose,
  currentBatchId,
  chicksCount,
}) {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [mortalityDate, setMortalityDate] = useState(null);
  const [mortalityCount, setMortalityCount] = useState("");
  const [showDateCalendar, setShowDateCalendar] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [errors, setErrors] = useState({
    mortalityDate: "",
    mortalityCount: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Auto-fetch batchId from brooderInfo collection
  useEffect(() => {
    if (visible && currentBatchId) {
      setBatchId(currentBatchId);
    }
  }, [visible, currentBatchId]);

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const validateForm = () => {
    const newErrors = {
      mortalityDate: "",
      mortalityCount: "",
    };

    let isValid = true;

    // Validate mortality date
    if (!mortalityDate) {
      newErrors.mortalityDate = "Please select a date";
      isValid = false;
    } else {
      // Check if date is within allowed range (January 2025 to current date)
      const minDate = new Date(2025, 0, 1); // January 1, 2025
      const maxDate = new Date();

      if (mortalityDate < minDate) {
        newErrors.mortalityDate = "Date must be from January 2025 onwards";
        isValid = false;
      } else if (mortalityDate > maxDate) {
        newErrors.mortalityDate = "Future dates are not allowed";
        isValid = false;
      }
    }

    // Validate mortality count
    const count = parseInt(mortalityCount);
    if (!mortalityCount || count <= 0) {
      newErrors.mortalityCount = "Enter a valid mortality count";
      isValid = false;
    } else if (count > parseInt(chicksCount)) {
      newErrors.mortalityCount = `Cannot exceed chicks count (${chicksCount})`;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "User not authenticated");
        setIsSaving(false);
        return;
      }

      // Save mortality report as a new document under mortality/{batchId}/
      const { doc, collection, addDoc, getDocs, getDoc, updateDoc } =
        await import("firebase/firestore");
      const batchMortalityRef = collection(db, "mortality", batchId, "reports");
      await addDoc(batchMortalityRef, {
        date: mortalityDate,
        count: parseInt(mortalityCount),
        batchId: batchId,
        loggedBy: currentUser.uid,
        createdAt: new Date(),
      });

      // Compute total mortality for this batch
      const snapshot = await getDocs(batchMortalityRef);
      let totalMortality = 0;
      snapshot.forEach((docSnap) => {
        totalMortality += docSnap.data().count || 0;
      });

      // Fetch initialCount from brooderInfo
      const brooderRef = doc(db, "brooderInfo", batchId);
      const brooderSnap = await getDoc(brooderRef);
      const initialCount = brooderSnap.exists()
        ? brooderSnap.data().initialCount
        : 0;

      // Compute updated chicksCount
      const updatedChicksCount = initialCount - totalMortality;

      // Update brooderInfo with new chicksCount
      await updateDoc(brooderRef, { chicksCount: updatedChicksCount });

      // Log to session_logs collection
      await addDoc(collection(db, "session_logs"), {
        userId: currentUser.uid,
        action: "Mortality reported",
        description: "Mortality recorded for " + batchId,
        batchId: batchId,
        timestamp: new Date(),
        details: {
          mortalityCount: parseInt(mortalityCount),
          mortalityDate: mortalityDate,
        },
      });

      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error saving mortality record:", error);
      Alert.alert("Error", "Failed to save mortality record");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setMortalityDate(null);
    setMortalityCount("");
    setBatchId("");
    setErrors({
      mortalityDate: "",
      mortalityCount: "",
    });
    onClose();
  };

  return (
    <>
      {showSuccessModal && (
        <Modal
          visible={showSuccessModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSuccessModal(false)}
        >
          <View style={styles.backdrop}>
            <View style={[styles.container, { maxWidth: 350, padding: 32 }]}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: "#154b99",
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                Success!
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: "#1a1a1a",
                  textAlign: "center",
                  marginBottom: 24,
                }}
              >
                Mortality record saved successfully.
              </Text>
              <TouchableOpacity
                style={[styles.saveButton, { marginTop: 0 }]}
                onPress={() => {
                  setShowSuccessModal(false);
                  handleClose();
                }}
              >
                <Text style={styles.saveButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      {!showSuccessModal && (
        <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={handleClose}
        >
          <View style={styles.backdrop}>
            <View style={styles.container}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.backButton}
                >
                  <Icon name="chevron-left" size={24} color="#1a1a1a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Report Mortality</Text>
                <View style={{ width: 24 }} />
              </View>

              {/* Form */}
              <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.form}>
                  {/* Batch ID - Read-only */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Batch ID</Text>
                    <View style={styles.readOnlyInput}>
                      <Text style={styles.readOnlyText}>
                        {batchId || "N/A"}
                      </Text>
                    </View>
                  </View>

                  {/* Mortality Date */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Mortality Date</Text>
                    <TouchableOpacity
                      style={[
                        styles.dateInput,
                        errors.mortalityDate && styles.inputError,
                      ]}
                      onPress={() => setShowDateCalendar(true)}
                    >
                      <Icon name="calendar" size={16} color="#64748b" />
                      <Text
                        style={[
                          styles.dateText,
                          !mortalityDate && styles.placeholderText,
                        ]}
                      >
                        {mortalityDate
                          ? formatDate(mortalityDate)
                          : "Select a date"}
                      </Text>
                    </TouchableOpacity>
                    {errors.mortalityDate ? (
                      <Text style={styles.errorText}>
                        {errors.mortalityDate}
                      </Text>
                    ) : null}
                  </View>

                  {/* Mortality Count */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Mortality Count</Text>
                    <TextInput
                      style={[
                        styles.input,
                        errors.mortalityCount && styles.inputError,
                      ]}
                      placeholder="Enter number of mortalities"
                      placeholderTextColor="#9ca3af"
                      value={mortalityCount}
                      onChangeText={(text) => {
                        setMortalityCount(text);
                        setErrors({ ...errors, mortalityCount: "" });
                      }}
                      keyboardType="numeric"
                    />
                    {errors.mortalityCount ? (
                      <Text style={styles.errorText}>
                        {errors.mortalityCount}
                      </Text>
                    ) : null}
                    <Text style={styles.helperText}>
                      Maximum: {chicksCount || 0} chicks
                    </Text>
                  </View>

                  {/* Save Button */}
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      isSaving && styles.saveButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={isSaving}
                  >
                    <Text style={styles.saveButtonText}>
                      {isSaving ? "Saving..." : "Save Mortality Record"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {/* Calendar Modal */}
              <CalendarModal
                visible={showDateCalendar}
                onClose={() => setShowDateCalendar(false)}
                onSelectDate={(date) => {
                  setMortalityDate(date);
                  setErrors({ ...errors, mortalityDate: "" });
                }}
                minimumDate={new Date(2025, 0, 1)} // January 1, 2025
                maximumDate={new Date()} // Current date
              />
            </View>
          </View>
        </Modal>
      )}
    </>
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
    width: "90%",
    maxWidth: 500,
    maxHeight: "85%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  scrollView: {
    maxHeight: "100%",
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  readOnlyText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  placeholderText: {
    color: "#9ca3af",
    fontWeight: "400",
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: "#154b99",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
});
