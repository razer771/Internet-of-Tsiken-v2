// screensample/ControlScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  Alert,
  Platform,
  PanResponder,
} from "react-native";
import Slider from "@react-native-community/slider";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#133E87";
const GREEN = "#249D1D";
const RED = "#D70E11";
const YELLOW = "#DFB118";
const BORDER_OVERLAY = "#0D609C73";

export default function ControlScreen({ navigation }) {
  // side menu
  const [menuOpen, setMenuOpen] = useState(false);

  // realtime

  const [waterNow] = useState(85);
  const [feederNow] = useState(62);

  // controls
  const [lightOn, setLightOn] = useState(false);
  const [fanOn, setFanOn] = useState(false);

  // night schedule (time)
  const [nightStart, setNightStart] = useState(new Date());
  const [showNightPicker, setShowNightPicker] = useState(false);

  // feed schedule: can add / delete / edit
  const [feeds, setFeeds] = useState([
    { id: 1, label: "Morning", time: "06:00 AM" },
    { id: 2, label: "Noon", time: "12:00 PM" },
    { id: 3, label: "Evening", time: "05:00 PM" },
  ]);
  const [feedEdit, setFeedEdit] = useState({
    open: false,
    idx: null,
    timeDate: new Date(),
  });

  // delete mode / selection
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedToDelete, setSelectedToDelete] = useState([]);

  // confirm modals
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [confirmSaveVisible, setConfirmSaveVisible] = useState(false);

  // water schedule
  const [waterDate, setWaterDate] = useState(new Date());
  const [showWaterDatePicker, setShowWaterDatePicker] = useState(false);
  const [waterTime, setWaterTime] = useState(new Date());
  const [showWaterTimePicker, setShowWaterTimePicker] = useState(false);
  const [liters, setLiters] = useState(30);
  const [duration, setDuration] = useState(30);

  // popups
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [dispenseModal, setDispenseModal] = useState(false);
  const [sprinklerModal, setSprinklerModal] = useState(false);

  // camera placeholder modal
  const [cameraModal, setCameraModal] = useState(false);

  // power schedule
  const [alertThreshold, setAlertThreshold] = useState(30);
  const [autoPower, setAutoPower] = useState(false);

  // bottom active
  const [activeTab, setActiveTab] = useState("Control");

  // timepicker state for feed edit
  const [showFeedTimePicker, setShowFeedTimePicker] = useState(false);

  // Swipe gesture handler - swipe right to go to Home, swipe left to go to Analytics
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes (not vertical scrolling)
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 20
        );
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Swipe right (positive dx) to go back to Home (slide left to right)
        if (gestureState.dx > 50) {
          navigation.goBack();
        }
        // Swipe left (negative dx) to go to Analytics (if you have it)
        // if (gestureState.dx < -50) {
        //   navigation.navigate("Analytics");
        // }
      },
    })
  ).current;

  // Handlers
  const addFeedSchedule = () => {
    const nextId = feeds.length ? Math.max(...feeds.map((f) => f.id)) + 1 : 1;
    // default new schedule at current time formatted
    const now = new Date();
    const defaultTime = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const label = `Schedule ${nextId}`;
    setFeeds((s) => [...s, { id: nextId, label, time: defaultTime }]);
  };

  const beginDeleteFlow = () => {
    // Show options: Delete All or Choose
    Alert.alert(
      "Delete schedules",
      "Choose delete option",
      [
        {
          text: "Delete All",
          style: "destructive",
          onPress: () => setConfirmDeleteVisible(true),
        },
        {
          text: "Choose",
          onPress: () => {
            setDeleteMode(true);
            setSelectedToDelete([]);
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const confirmDeleteAll = () => {
    setFeeds([]);
    setDeleteMode(false);
    setSelectedToDelete([]);
    setConfirmDeleteVisible(false);
    // show brief popup
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1200);
  };

  const toggleSelectToDelete = (id) => {
    setSelectedToDelete((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      return [...s, id];
    });
  };

  const deleteSelected = () => {
    if (selectedToDelete.length === 0) {
      Alert.alert(
        "No selection",
        "Please select at least one schedule to delete."
      );
      return;
    }
    // confirmation
    Alert.alert(
      "Delete selected",
      "Are you sure you want to delete selected schedules?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setFeeds((s) => s.filter((f) => !selectedToDelete.includes(f.id)));
            setDeleteMode(false);
            setSelectedToDelete([]);
            setShowSavedPopup(true);
            setTimeout(() => setShowSavedPopup(false), 1200);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const beginSaveFlow = () => {
    // show confirmation modal
    setConfirmSaveVisible(true);
  };

  const confirmSaveAll = () => {
    // In real app, call API to save feeds
    setConfirmSaveVisible(false);
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1400);
  };

  const openEditFeed = (idx) => {
    // open edit modal with Date object based on existing time string if possible
    const f = feeds[idx];
    // try parse time string "hh:mm AM/PM" into Date
    let timeDate = new Date();
    try {
      const parts = f.time.split(/[: ]/); // ["06","00","AM"]
      if (parts.length >= 3) {
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);
        const ampm = parts[2];
        let hr = hour % 12;
        if (ampm.toUpperCase() === "PM") hr += 12;
        timeDate.setHours(hr, minute, 0, 0);
      }
    } catch (e) {
      timeDate = new Date();
    }
    setFeedEdit({ open: true, idx, timeDate });
  };

  const saveFeedEdit = () => {
    if (feedEdit.idx === null) return;
    const newTime = feedEdit.timeDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setFeeds((s) => {
      const copy = [...s];
      copy[feedEdit.idx].time = newTime;
      return copy;
    });
    setFeedEdit({ open: false, idx: null, timeDate: new Date() });
  };

  const handleDispense = () => {
    setDispenseModal(true);
    setTimeout(() => setDispenseModal(false), 1600);
  };

  const handleSprinkler = () => {
    setSprinklerModal(true);
    setTimeout(() => setSprinklerModal(false), 1600);
  };

  const saveWaterSchedule = () => {
    // Optionally validate values:
    // if (liters <= 0) { Alert.alert("Invalid", "Liters must be > 0"); return; }
    setShowSavedPopup(true);
    setTimeout(() => setShowSavedPopup(false), 1400);
  };
  // helpers
  const fmtDate = (d) => d.toISOString().split("T")[0];
  const fmtTime = (d) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // power bar width calculation (we'll map alertThreshold 0-100 to width)
  const powerBarWidth = (percent) => {
    // base width in style is 270; map percent to that width
    const max = 270;
    return (percent / 100) * max;
  };

  return (
    <View style={styles.page} {...panResponder.panHandlers}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Page Title */}
        <Text style={styles.pageTitle}>REAL-TIME STATUS</Text>

        {/* Real-time cards */}
        <View style={styles.rowCenter}>
          <StatCard
            label="Water Level"
            value={`${waterNow}%`}
            dotColor="#4CAF50"
          />
          <StatCard
            label="Feeder Level"
            value={`${feederNow}%`}
            dotColor="#2196F3"
          />
        </View>

        {/* Live Camera */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader
            icon="videocam-outline"
            title="Live Camera Surveillance"
          />
          <TouchableOpacity
            style={styles.cameraBox}
            onPress={() => setCameraModal(true)}
          >
            <Image
              source={require("../../assets/proposal meeting.png")}
              style={styles.cameraImage}
            />
            <View style={styles.liveBadge}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>● LIVE</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Lighting */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="bulb-outline" title="Lighting Control" />
          <View
            style={[
              styles.innerBox,
              { marginTop: 8, borderColor: BORDER_OVERLAY },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="sunny-outline"
                size={18}
                color="#333"
                style={{ marginRight: 8 }}
              />
              <Text style={{ fontWeight: "600" }}>Incandescent Light</Text>
            </View>
            <Switch
              value={lightOn}
              onValueChange={setLightOn}
              trackColor={{ false: "#B0B0B0", true: PRIMARY }}
              ios_backgroundColor="#B0B0B0"
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Ventilation */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="sync-outline" title="Ventilation" />
          <View
            style={[
              styles.innerBox,
              { marginTop: 8, borderColor: BORDER_OVERLAY },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name="sync-outline"
                size={18}
                color="#333"
                style={{ marginRight: 8 }}
              />
              <Text style={{ fontWeight: "600" }}>Exhaust Fan</Text>
            </View>
            <Switch
              value={fanOn}
              onValueChange={setFanOn}
              trackColor={{ false: "#B0B0B0", true: PRIMARY }}
              ios_backgroundColor="#B0B0B0"
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Night Schedule */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="moon-outline" title="Night Schedule" />
          <View style={styles.rowSpace}>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Night Time Start</Text>
              <TouchableOpacity
                style={styles.timeInput}
                onPress={() => setShowNightPicker(true)}
              >
                <Text style={styles.timeText}>{fmtTime(nightStart)}</Text>
                <Ionicons name="time-outline" size={18} color={PRIMARY} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.smallNote, { marginTop: 8 }]}>
            Solar power will activate at this time
          </Text>
        </View>

        {/* Feeding Schedule */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="fast-food-outline" title="Feeding Schedule" />

          {/* Action buttons: Add, Delete, Save */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              marginBottom: 8,
            }}
          >
            <TouchableOpacity
              style={[styles.smallActionBtn, { backgroundColor: GREEN }]}
              onPress={addFeedSchedule}
            >
              <Text style={styles.smallActionText}>Add</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.smallActionBtn,
                { backgroundColor: RED, marginLeft: 8 },
              ]}
              onPress={beginDeleteFlow}
            >
              <Text style={styles.smallActionText}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.smallActionBtn,
                { backgroundColor: PRIMARY, marginLeft: 8 },
              ]}
              onPress={beginSaveFlow}
            >
              <Text style={styles.smallActionText}>Save</Text>
            </TouchableOpacity>
          </View>

          {feeds.length === 0 ? (
            <Text style={{ color: "#666", paddingVertical: 8 }}>
              No feeding schedules.
            </Text>
          ) : (
            feeds.map((f, idx) => (
              <View key={f.id} style={styles.feedRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {deleteMode ? (
                    <TouchableOpacity
                      onPress={() => toggleSelectToDelete(f.id)}
                      style={[
                        styles.checkbox,
                        selectedToDelete.includes(f.id) &&
                          styles.checkboxChecked,
                      ]}
                    >
                      {selectedToDelete.includes(f.id) && (
                        <Text style={{ color: "#fff" }}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={PRIMARY}
                      style={{ marginRight: 8 }}
                    />
                  )}

                  <Text style={{ fontWeight: "600" }}>{f.time}</Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openEditFeed(idx)}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* If deleteMode active show Delete Selected button */}
          {deleteMode && (
            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                justifyContent: "flex-end",
              }}
            >
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: RED }]}
                onPress={deleteSelected}
              >
                <Text style={styles.smallActionText}>Delete selected</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: "#999", marginLeft: 8 },
                ]}
                onPress={() => {
                  setDeleteMode(false);
                  setSelectedToDelete([]);
                }}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Water Scheduling */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader icon="water-outline" title="Water Scheduling" />
          <View style={styles.rowSpace}>
            <TouchableOpacity
              style={[styles.dateBox, { backgroundColor: "#7C8CA821" }]}
              onPress={() => setShowWaterDatePicker(true)}
            >
              <Text style={{ fontWeight: "600" }}>{fmtDate(waterDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => setShowWaterTimePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.smallLabel}>Watering Time</Text>
            <TouchableOpacity
              style={[styles.timeInput, { marginTop: 6 }]}
              onPress={() => setShowWaterTimePicker(true)}
            >
              <Text>{fmtTime(waterTime)}</Text>
            </TouchableOpacity>

            <Text style={[styles.smallLabel, { marginTop: 8 }]}>
              Liters: {liters}L
            </Text>
            <Slider
              minimumValue={1}
              maximumValue={60}
              step={1}
              value={liters}
              onValueChange={setLiters}
              minimumTrackTintColor={PRIMARY}
            />

            <Text style={[styles.smallLabel, { marginTop: 8 }]}>
              Duration (seconds): {duration}s
            </Text>
            <Slider
              minimumValue={5}
              maximumValue={120}
              step={1}
              value={duration}
              onValueChange={setDuration}
              minimumTrackTintColor={PRIMARY}
            />

            <View
              style={[
                styles.upcomingBox,
                { backgroundColor: "#BDCBE421", borderColor: "#0D609C54" },
              ]}
            >
              <Text>
                Upcoming scheduled: {fmtDate(waterDate)} at {fmtTime(waterTime)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 10 }]}
              onPress={() => {
                saveWaterSchedule();
              }}
            >
              <Text style={styles.primaryBtnText}>Save schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Power Schedule */}
        <View style={[styles.card, { borderColor: BORDER_OVERLAY }]}>
          <CardHeader
            icon="flash-outline"
            title="Power Schedule"
            rightText={"62%"}
          />

          <View style={{ marginTop: 8 }}>
            <Text style={styles.smallLabel}>Solar power level</Text>

            {/* Horizontal bar container (looks like the requested layout) */}
            <View style={styles.powerBarContainer}>
              <View
                style={[
                  styles.powerBarFill,
                  { width: powerBarWidth(alertThreshold) },
                ]}
              />
            </View>

            <Text style={[styles.smallNote, { marginTop: 8 }]}>
              Moderate Power - Monitor closely
            </Text>

            <Text style={[styles.smallLabel, { marginTop: 12 }]}>
              Alert threshold (%) {alertThreshold}%
            </Text>
            <Slider
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={alertThreshold}
              onValueChange={setAlertThreshold}
              minimumTrackTintColor={YELLOW}
            />

            <View style={{ marginTop: 10 }}>
              <View style={styles.rowSpace}>
                <Text style={{ fontWeight: "600" }}>
                  Enable automatic power management
                </Text>
                <Switch
                  value={autoPower}
                  onValueChange={setAutoPower}
                  trackColor={{ false: "#B0B0B0", true: PRIMARY }}
                  ios_backgroundColor="#B0B0B0"
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>
        </View>

        {/* Continue / Pause */}
        <View style={{ marginHorizontal: 14, marginTop: 14 }}>
          <TouchableOpacity
            style={[styles.continueBtn]}
            onPress={() => Alert.alert("Continue", "Continue operations")}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              Continue Operations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pauseBtn]}
            onPress={() => Alert.alert("Pause", "Paused non-critical tasks")}
          >
            <Text style={{ fontWeight: "700" }}>Pause non-critical tasks</Text>
          </TouchableOpacity>
        </View>

        {/* Activity Log */}
        <View
          style={[styles.card, { borderColor: BORDER_OVERLAY, marginTop: 14 }]}
        >
          <Text style={[styles.cardTitle]}>Activity Log</Text>
          <View style={[styles.logItem]}>
            <Text style={{ fontWeight: "700" }}>Predatory Alert</Text>
            <Text style={{ color: "#666" }}>
              Water sprinkler and lights activated
            </Text>
            <Text style={{ color: "#999", fontSize: 12, marginTop: 6 }}>
              10/21/2025, 9:35 PM
            </Text>
          </View>
        </View>

        {/* Manual Actions */}
        <View
          style={[
            styles.card,
            { borderColor: BORDER_OVERLAY, marginTop: 14, marginBottom: 28 },
          ]}
        >
          <Text style={styles.cardTitle}>Manual Actions</Text>

          <TouchableOpacity style={styles.actionBtn} onPress={handleDispense}>
            <Text style={styles.actionText}>Dispense Feed Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { marginTop: 10 }]}
            onPress={handleSprinkler}
          >
            <Text style={styles.actionText}>Activate Water Sprinkler</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Date / Time Pickers */}
      {showWaterDatePicker && (
        <DateTimePicker
          value={waterDate}
          mode="date"
          display="default"
          onChange={(_, selected) => {
            setShowWaterDatePicker(false);
            if (selected) setWaterDate(selected);
          }}
        />
      )}
      {showWaterTimePicker && (
        <DateTimePicker
          value={waterTime}
          mode="time"
          display="default"
          onChange={(_, selected) => {
            setShowWaterTimePicker(false);
            if (selected) setWaterTime(selected);
          }}
        />
      )}
      {showNightPicker && (
        <DateTimePicker
          value={nightStart}
          mode="time"
          display="default"
          onChange={(_, selected) => {
            setShowNightPicker(false);
            if (selected) setNightStart(selected);
          }}
        />
      )}

      {/* Feed Edit Modal (time picker like night schedule) */}
      <Modal visible={feedEdit.open} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={() =>
            setFeedEdit({ open: false, idx: null, timeDate: new Date() })
          }
        />
        <View style={styles.editModal}>
          <Text style={styles.modalTitle}>Edit Feeding Time</Text>

          <TouchableOpacity
            style={[styles.timeInput, { marginTop: 6 }]}
            onPress={() => setShowFeedTimePicker(true)}
          >
            <Text style={styles.timeText}>
              {feedEdit.timeDate ? fmtTime(feedEdit.timeDate) : "Select time"}
            </Text>
            <Ionicons name="time-outline" size={18} color={PRIMARY} />
          </TouchableOpacity>

          {showFeedTimePicker && (
            <DateTimePicker
              value={feedEdit.timeDate || new Date()}
              mode="time"
              display="default"
              onChange={(_, selected) => {
                setShowFeedTimePicker(false);
                if (selected)
                  setFeedEdit((s) => ({ ...s, timeDate: selected }));
              }}
            />
          )}

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 10,
            }}
          >
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1, marginRight: 6 }]}
              onPress={saveFeedEdit}
            >
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: "#999", flex: 1 }]}
              onPress={() =>
                setFeedEdit({ open: false, idx: null, timeDate: new Date() })
              }
            >
              <Text style={styles.primaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Camera Modal */}
      <Modal visible={cameraModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={() => setCameraModal(false)}
        />
        <View style={styles.editModal}>
          <Text style={styles.modalTitle}>Live Camera</Text>
          <Image
            source={require("../../assets/proposal meeting.png")}
            style={{ width: "100%", height: 220, borderRadius: 8 }}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 12 }]}
            onPress={() =>
              Alert.alert("Connect", "Placeholder to connect to IoT camera")
            }
          >
            <Text style={styles.primaryBtnText}>Connect to IoT Stream</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Confirm delete all */}
      <Modal visible={confirmDeleteVisible} transparent animationType="fade">
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Delete all schedules?
            </Text>
            <Text style={{ color: "#666", marginTop: 8 }}>
              This will remove all feeding schedules.
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#999" }]}
                onPress={() => setConfirmDeleteVisible(false)}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: RED, marginLeft: 8 },
                ]}
                onPress={confirmDeleteAll}
              >
                <Text style={styles.smallActionText}>Delete All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Save */}
      <Modal visible={confirmSaveVisible} transparent animationType="fade">
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              Save schedules?
            </Text>
            <Text style={{ color: "#666", marginTop: 8 }}>
              Are you sure you want to save all feeding schedules?
            </Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: "#999" }]}
                onPress={() => setConfirmSaveVisible(false)}
              >
                <Text style={styles.smallActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: PRIMARY, marginLeft: 8 },
                ]}
                onPress={confirmSaveAll}
              >
                <Text style={styles.smallActionText}>Yes, Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Save popup */}
      <Modal visible={showSavedPopup} transparent animationType="fade">
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Image
              source={require("../../assets/logo.png")}
              style={{ width: 56, height: 56 }}
            />
            <Text style={styles.popupText}>Saved Successfully!</Text>
          </View>
        </View>
      </Modal>

      {/* Dispense / Sprinkler simple popups */}
      <Modal visible={dispenseModal} transparent animationType="fade">
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={styles.popupText}>Dispense Feed Success</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={sprinklerModal} transparent animationType="fade">
        <View style={styles.popupBackground}>
          <View style={styles.popupBox}>
            <Text style={styles.popupText}>Sprinkler Activated</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- helpers ---------------- */
function StatCard({ label, value, dotColor }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statLeft}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <View style={styles.statRight}>
        <View style={[styles.statBox, { borderLeftColor: PRIMARY }]}>
          <Text style={styles.statValue}>{value}</Text>
        </View>
      </View>
    </View>
  );
}

function CardHeader({ icon, title, rightText }) {
  return (
    <View style={styles.cardHeader}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Ionicons
          name={icon}
          size={20}
          color={PRIMARY}
          style={{ marginRight: 8 }}
        />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {rightText ? (
        <Text style={styles.cardRightValue}>{rightText}</Text>
      ) : null}
    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F6FA" },
  container: { flex: 1, paddingHorizontal: 14 },

  pageTitle: { fontSize: 14, color: PRIMARY, fontWeight: "700", marginTop: 14 },

  statCard: {
    width: "100%",
    maxWidth: 340,
    height: 55,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  statLeft: { flexDirection: "row", alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 6, marginRight: 10 },
  statLabel: { fontSize: 15, fontWeight: "600", color: "#333" },
  statRight: { alignItems: "flex-end" },
  statBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 4,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  statValue: { color: PRIMARY, fontWeight: "700", fontSize: 16 },

  rowCenter: { alignItems: "center" },

  card: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: PRIMARY },
  cardRightValue: { fontWeight: "700", color: PRIMARY },

  cameraBox: {
    marginTop: 10,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  cameraImage: { width: "100%", height: 145, resizeMode: "cover" },
  liveBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "red",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  smallNote: { color: "#666", marginTop: 6 },
  innerBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  rowSpace: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeInput: {
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeText: { fontWeight: "700", color: "#333" },
  smallLabel: { color: "#444", fontSize: 13 },

  feedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  editBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editText: { color: "#fff", fontWeight: "700" },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#999",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxChecked: { backgroundColor: RED, borderColor: RED },

  dateBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    width: "72%",
    alignItems: "center",
  },
  smallBtn: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },

  upcomingBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0D609C54",
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: PRIMARY,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },

  smallActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  smallActionText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  continueBtn: {
    backgroundColor: GREEN,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  pauseBtn: {
    backgroundColor: "#BDCBE421",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  logItem: {
    backgroundColor: "#BDCBE421",
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0D609C54",
  },

  actionBtn: {
    backgroundColor: PRIMARY,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "700" },

  // modals
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  editModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    elevation: 10,
  },
  modalTitle: { fontWeight: "700", fontSize: 16, marginBottom: 8 },
  formInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
  },

  popupBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  popupBox: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 12,
    alignItems: "center",
  },
  popupText: { marginTop: 10, fontSize: 16, fontWeight: "700", color: GREEN },

  // power bar
  powerBarContainer: {
    width: 270,
    height: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0D609C54",
    backgroundColor: "#eee",
    overflow: "hidden",
    marginTop: 8,
  },
  powerBarFill: {
    height: "100%",
    backgroundColor: YELLOW,
    borderRadius: 8,
  },

  // small helpers
  dateText: { fontWeight: "700" },
});
