import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import CalendarModal from "../../navigation/CalendarModal";
import TimePickerDropdown from "../../test/Talan/TimePickerDropdown";

const Icon = Feather;

export default function GenerateLogReportModal({
  visible,
  onClose,
  onGenerate,
}) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [hours, setHours] = useState("09");
  const [minutes, setMinutes] = useState("00");
  const [period, setPeriod] = useState("AM");
  const [showHoursPicker, setShowHoursPicker] = useState(false);
  const [showMinutesPicker, setShowMinutesPicker] = useState(false);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [details, setDetails] = useState("");
  const [description, setDescription] = useState("");

  const roles = ["Owner", "Admin", "User"];
  const hoursList = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    value: String(i + 1).padStart(2, "0"),
  }));
  const minutesList = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    value: String(i).padStart(2, "0"),
  }));
  const periodList = [
    { id: 0, value: "AM" },
    { id: 1, value: "PM" },
  ];

  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}-${day}-${year}`;
  };

  const formatTime = () => {
    return `${hours}:${minutes} ${period}`;
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleGenerate = () => {
    if (!selectedRole || !details || !description) {
      alert("Please fill in all fields");
      return;
    }

    const logData = {
      date: formatDate(selectedDate),
      time: formatTime(),
      role: selectedRole,
      action: details,
      description: description,
    };

    onGenerate(logData);
    resetForm();
  };

  const resetForm = () => {
    setSelectedDate(new Date());
    setHours("09");
    setMinutes("00");
    setPeriod("AM");
    setSelectedRole("");
    setDetails("");
    setDescription("");
    setShowRoleDropdown(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate Log Report</Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
              >
                <Icon name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Date Section */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowCalendar(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.inputText}>
                    {formatDate(selectedDate)}
                  </Text>
                  <Icon name="calendar" size={18} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Time Section */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Time</Text>
                <View style={styles.timeRow}>
                  {/* Hours */}
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowHoursPicker(true)}
                  >
                    <Text style={styles.timeButtonText}>{hours}</Text>
                    <Icon name="chevron-down" size={14} color="#64748b" />
                  </TouchableOpacity>

                  <Text style={styles.timeSeparator}>:</Text>

                  {/* Minutes */}
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowMinutesPicker(true)}
                  >
                    <Text style={styles.timeButtonText}>{minutes}</Text>
                    <Icon name="chevron-down" size={14} color="#64748b" />
                  </TouchableOpacity>

                  {/* Period */}
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowPeriodPicker(true)}
                  >
                    <Text style={styles.timeButtonText}>{period}</Text>
                    <Icon name="chevron-down" size={14} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Role Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Select Role</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowRoleDropdown(!showRoleDropdown)}
                >
                  <Text
                    style={[
                      styles.inputText,
                      !selectedRole && styles.placeholder,
                    ]}
                  >
                    {selectedRole || "Select a role"}
                  </Text>
                  <Icon
                    name={showRoleDropdown ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {showRoleDropdown && (
                  <View style={styles.dropdown}>
                    {roles.map((role, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.dropdownOption,
                          index === roles.length - 1 &&
                            styles.dropdownOptionLast,
                        ]}
                        onPress={() => {
                          setSelectedRole(role);
                          setShowRoleDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownOptionText}>{role}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Action */}
              {!showRoleDropdown && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Action</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter action details"
                    value={details}
                    onChangeText={setDetails}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              )}

              {/* Description */}
              {!showRoleDropdown && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Enter Description</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Enter description"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              )}

              {/* Generate Button */}
              {!showRoleDropdown && (
                <Pressable onPress={handleGenerate}>
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.generateButtonInner,
                        pressed && styles.generateButtonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.generateButtonText,
                          pressed && styles.generateButtonTextPressed,
                        ]}
                      >
                        Generate Log Report
                      </Text>
                    </View>
                  )}
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Calendar Modal */}
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelectDate={handleDateSelect}
      />

      {/* Time Picker Modals */}
      <TimePickerDropdown
        visible={showHoursPicker}
        onClose={() => setShowHoursPicker(false)}
        data={hoursList}
        onSelect={setHours}
        title="Select Hour"
      />

      <TimePickerDropdown
        visible={showMinutesPicker}
        onClose={() => setShowMinutesPicker(false)}
        data={minutesList}
        onSelect={setMinutes}
        title="Select Minute"
      />

      <TimePickerDropdown
        visible={showPeriodPicker}
        onClose={() => setShowPeriodPicker(false)}
        data={periodList}
        onSelect={setPeriod}
        title="Select Period"
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeButton: {
    padding: 4,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
  },
  inputText: {
    fontSize: 14,
    color: "#1a1a1a",
    flex: 1,
  },
  placeholder: {
    color: "#94a3b8",
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    width: 70,
    gap: 4,
  },
  timeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  timeSeparator: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  dropdown: {
    marginTop: 8,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionText: {
    fontSize: 14,
    color: "#1a1a1a",
    fontWeight: "500",
  },
  generateButtonInner: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 8,
  },
  generateButtonPressed: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  generateButtonText: {
    color: "#1a1a1a",
    fontSize: 15,
    fontWeight: "700",
  },
  generateButtonTextPressed: {
    color: "#ffffff",
  },
});
