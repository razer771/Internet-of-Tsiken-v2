import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import Header2 from "../navigation/adminHeader";

export default function GenerateLogReport({ navigation }) {
  const [dateTime, setDateTime] = useState("");
  const [role, setRole] = useState("");
  const [action, setAction] = useState("");
  const [description, setDescription] = useState("");
  const [roleOpen, setRoleOpen] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  
  // Track which field is focused
  const [focusedField, setFocusedField] = useState(null);
  // Track generate button press
  const [generatePressed, setGeneratePressed] = useState(false);
  // Track back button press
  const [pressedBtn, setPressedBtn] = useState(null);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [hours, setHours] = useState(3);
  const [minutes, setMinutes] = useState(33);
  const [ampm, setAmpm] = useState("AM");

  const roles = ["Owner", "Manager", "Worker"];

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    return { firstDay, daysInMonth, prevMonthDays };
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateSelect = (day) => {
    setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
  };

  const handleConfirm = () => {
    const formatted = `${monthNames[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    setDateTime(formatted);
    setCalendarVisible(false);
    setFocusedField(null);
  };

  const renderCalendar = () => {
    const { firstDay, daysInMonth, prevMonthDays } = getDaysInMonth(currentMonth);
    const days = [];
    const today = new Date();

    const isToday = (day) =>
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear() &&
      day === today.getDate();

    const isSelected = (day) =>
      selectedDate &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear() &&
      day === selectedDate.getDate();

    // Previous month days (grayed out)
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push(
        <View key={`prev-${i}`} style={styles.calendarDay}>
          <Text style={[styles.calendarDayText, styles.calendarDayInactive]}>
            {prevMonthDays - i}
          </Text>
        </View>
      );
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const selected = isSelected(day);
      days.push(
        <TouchableOpacity
          key={day}
          style={[styles.calendarDay]}
          onPress={() => handleDateSelect(day)}
        >
          <View style={[styles.calendarDayButton, selected && styles.calendarDaySelected]}>
            <Text style={[
              styles.calendarDayText,
              selected && styles.calendarDayTextSelected
            ]}>
              {day}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Next month days (grayed out)
    const totalCells = firstDay + daysInMonth;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) {
      days.push(
        <View key={`next-${i}`} style={styles.calendarDay}>
          <Text style={[styles.calendarDayText, styles.calendarDayInactive]}>{i}</Text>
        </View>
      );
    }

    return days;
  };

  const handleGenerateReport = () => {
    // Show success modal
    setSuccessVisible(true);
    
    // Redirect after 2 seconds
    setTimeout(() => {
      setSuccessVisible(false);
      navigation.navigate("AdminActivityLogs");
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 showBackButton={true} />
      
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          style={[
            styles.backButton,
            pressedBtn === "back" && styles.backButtonPressed
          ]}
          activeOpacity={0.8}
          onPressIn={() => setPressedBtn("back")}
          onPressOut={() => setPressedBtn(null)}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={28}
            color={pressedBtn === "back" ? "#133E87" : "#000"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Date and Time */}
        <Text style={styles.label}>Date and Time</Text>
        <TouchableOpacity
          style={[
            styles.input,
            (focusedField === "dateTime" || dateTime) && styles.inputFocused
          ]}
          onPress={() => {
            setFocusedField("dateTime");
            setCalendarVisible(true);
          }}
        >
          <Text style={[styles.inputText, !dateTime && styles.placeholder]}>
            {dateTime || "Select Date and Time"}
          </Text>
          <MaterialCommunityIcons name="calendar-blank" size={20} color="#999" />
        </TouchableOpacity>

        {/* Role */}
        <Text style={styles.label}>Role</Text>
        <View style={styles.dropdownWrapper}>
          <TouchableOpacity
            style={[
              styles.input,
              (roleOpen || focusedField === "role" || role) && styles.inputFocused
            ]}
            onPress={() => {
              setFocusedField("role");
              setRoleOpen(o => !o);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.inputText, !role && styles.placeholder]}>
              {role || "Select Role"}
            </Text>
            <MaterialCommunityIcons
              name={roleOpen ? "chevron-up" : "chevron-down"}
              size={20}
              color="#999"
            />
          </TouchableOpacity>

          {roleOpen && (
            <View style={styles.dropdown}>
              {roles.map(r => (
                <TouchableOpacity
                  key={r}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setRole(r);
                    setRoleOpen(false);
                    setFocusedField(null);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Action */}
        <Text style={styles.label}>Action</Text>
        <TextInput
          style={[
            styles.input,
            (focusedField === "action" || action) && styles.inputFocused
          ]}
          placeholder="Enter Activity"
          placeholderTextColor="#999"
          value={action}
          onChangeText={setAction}
          onFocus={() => setFocusedField("action")}
          onBlur={() => setFocusedField(null)}
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            (focusedField === "description" || description) && styles.inputFocused
          ]}
          placeholder="Enter Description"
          placeholderTextColor="#999"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          onFocus={() => setFocusedField("description")}
          onBlur={() => setFocusedField(null)}
        />

        {/* Generate Button */}
        <TouchableOpacity
          style={[
            styles.generateButton,
            generatePressed && styles.generateButtonPressed
          ]}
          activeOpacity={0.8}
          onPressIn={() => setGeneratePressed(true)}
          onPressOut={() => setGeneratePressed(false)}
          onPress={handleGenerateReport}
        >
          <Text style={[
            styles.generateButtonText,
            generatePressed && styles.generateButtonTextPressed
          ]}>
            Generate Log Report
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Calendar Modal */}
      <Modal
        transparent
        visible={calendarVisible}
        animationType="fade"
        onRequestClose={() => {
          setCalendarVisible(false);
          setFocusedField(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setCalendarVisible(false);
            setFocusedField(null);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.calendarModal}>
            {/* Month Header */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.calendarArrow}>
                <MaterialCommunityIcons name="chevron-left" size={28} color="#234187" />
              </TouchableOpacity>
              <Text style={styles.calendarMonthYear}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.calendarArrow}>
                <MaterialCommunityIcons name="chevron-right" size={28} color="#234187" />
              </TouchableOpacity>
            </View>

            {/* Day names */}
            <View style={styles.calendarWeekRow}>
              {dayNames.map(day => (
                <View key={day} style={styles.calendarDayName}>
                  <Text style={styles.calendarDayNameText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.calendarGrid}>{renderCalendar()}</View>

            {/* Time Picker */}
            <View style={styles.timePicker}>
              {/* Hours */}
              <View style={styles.timeColumn}>
                <TouchableOpacity
                  style={styles.timeArrow}
                  onPress={() => setHours(h => (h === 12 ? 1 : h + 1))}
                >
                  <MaterialCommunityIcons name="chevron-up" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.timeValue}>{hours.toString().padStart(2, '0')}</Text>
                <Text style={styles.timeLabel}>{(hours === 1 ? 12 : hours - 1).toString().padStart(2, '0')}</Text>
                <Text style={styles.timeLabel}>{(hours === 12 ? 1 : hours + 1).toString().padStart(2, '0')}</Text>
                <TouchableOpacity
                  style={styles.timeArrow}
                  onPress={() => setHours(h => (h === 1 ? 12 : h - 1))}
                >
                  <MaterialCommunityIcons name="chevron-down" size={24} color="#000" />
                </TouchableOpacity>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              {/* Minutes */}
              <View style={styles.timeColumn}>
                <TouchableOpacity
                  style={styles.timeArrow}
                  onPress={() => setMinutes(m => (m === 59 ? 0 : m + 1))}
                >
                  <MaterialCommunityIcons name="chevron-up" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.timeValue}>{minutes.toString().padStart(2, '0')}</Text>
                <Text style={styles.timeLabel}>{(minutes === 0 ? 59 : minutes - 1).toString().padStart(2, '0')}</Text>
                <Text style={styles.timeLabel}>{(minutes === 59 ? 0 : minutes + 1).toString().padStart(2, '0')}</Text>
                <TouchableOpacity
                  style={styles.timeArrow}
                  onPress={() => setMinutes(m => (m === 0 ? 59 : m - 1))}
                >
                  <MaterialCommunityIcons name="chevron-down" size={24} color="#000" />
                </TouchableOpacity>
              </View>

              {/* AM/PM */}
              <View style={styles.ampmColumn}>
                <TouchableOpacity
                  style={[styles.ampmButton, ampm === "AM" && styles.ampmButtonActive]}
                  onPress={() => setAmpm("AM")}
                >
                  <Text style={[styles.ampmText, ampm === "AM" && styles.ampmTextActive]}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ampmButton, ampm === "PM" && styles.ampmButtonActive]}
                  onPress={() => setAmpm("PM")}
                >
                  <Text style={[styles.ampmText, ampm === "PM" && styles.ampmTextActive]}>PM</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Button */}
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Success Modal */}
      <Modal
        transparent
        visible={successVisible}
        animationType="fade"
      >
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <MaterialCommunityIcons name="check" size={48} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Report successfully generated</Text>
            <Text style={styles.successSubtitle}>Redirecting to Activity Logs...</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  backButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 16, // increased from 8 to 16
    paddingBottom: 8, // increased from 4 to 8
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  backButtonPressed: {
    backgroundColor: "rgba(19, 62, 135, 0.1)",
  },
  content: {
    padding: 20,
    paddingTop: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#000",
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputFocused: {
    borderColor: "#133E87",
    borderWidth: 2,
  },
  inputText: {
    fontSize: 15,
    color: "#000",
  },
  placeholder: {
    color: "#999",
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  dropdownWrapper: {
    position: "relative",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    marginTop: 4,
    zIndex: 10,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dropdownItemText: {
    fontSize: 15,
    color: "#000",
  },
  generateButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 32,
    alignSelf: "center",
    paddingHorizontal: 40,
  },
  generateButtonPressed: {
    backgroundColor: "#133E87",
    borderColor: "#133E87",
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  generateButtonTextPressed: {
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  calendarModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  calendarArrow: {
    padding: 8,
  },
  calendarMonthYear: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000",
  },
  calendarWeekRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  calendarDayName: {
    flex: 1,
    alignItems: "center",
  },
  calendarDayNameText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
  },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4,
  },
  calendarDayButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  calendarDaySelected: {
    backgroundColor: "#234187",
  },
  calendarDayText: {
    fontSize: 18,
    color: "#333",
    fontWeight: "400",
  },
  calendarDayTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  calendarDayInactive: {
    color: "#D1D5DB",
  },
  timePicker: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 10,
  },
  timeColumn: {
    alignItems: "center",
  },
  timeArrow: {
    padding: 4,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000",
    marginVertical: 4,
  },
  timeLabel: {
    fontSize: 16,
    color: "#D1D5DB",
  },
  timeSeparator: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000",
    marginTop: 8,
  },
  ampmColumn: {
    gap: 8,
    marginLeft: 12,
  },
  ampmButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
  },
  ampmButtonActive: {
    backgroundColor: "#234187",
  },
  ampmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  ampmTextActive: {
    color: "#fff",
  },
  confirmButton: {
    backgroundColor: "#234187",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4CAF50",
    textAlign: "center",
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});