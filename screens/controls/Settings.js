// Setting.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

// Helper function to handle navigation back
const navigateBack = (navigation) => {
  if (navigation && typeof navigation.goBack === 'function') {
    navigation.goBack();
    return;
  }
  console.log('navigateBack: navigation unavailable');
};

const Settings = ({ navigation }) => {
  // State for the modals
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

  // Side navigation visible state
  const [isSideNavVisible, setIsSideNavVisible] = useState(false);

  // Dummy state for text inputs (optional, but good practice)
  const [settings, setSettings] = useState({
    feed: '',
    water: '',
    powerSource: '',
    solarBattery: '',
    heatLamp: '',
    fan: '',
    light: '',
    systemAutoRestart: '',
  });

  const handleSaveChanges = () => {
    // Show the confirmation modal
    setIsConfirmModalVisible(true);
  };

  const handleConfirmSave = () => {
    // 1. Close confirmation modal
    setIsConfirmModalVisible(false);

    // 2. Perform the save logic (e.g., API call)
    console.log('Saving changes:', settings);

    // 3. Show success modal
    setIsSuccessModalVisible(true);

    // 4. Set a timeout to redirect after a brief display
    setTimeout(() => {
      setIsSuccessModalVisible(false);
      navigateBack(navigation); // Redirect to SideNavigation.js
    }, 1500); // Wait 1.5 seconds before redirecting
  };

  const handleCancelSave = () => {
    // Close confirmation modal
    setIsConfirmModalVisible(false);
  };

  // Field component for label + input stacked
  const Field = ({ label, value, onChange }) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        keyboardType="number-pad"
        onChangeText={(text) => {
          const numeric = text.replace(/[^0-9]/g, '');
          onChange(numeric);
        }}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top bar: back arrow (left) + centered title */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            navigation.goBack();
          }}
          accessible={true}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* --- Setting Inputs (below Settings title) --- */}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}> 
          <Field label="Feed" value={settings.feed} onChange={(v)=> setSettings({ ...settings, feed: v })} />
          <Field label="Water" value={settings.water} onChange={(v)=> setSettings({ ...settings, water: v })} />
        </View>

        <View style={styles.row}>
          <Field label="Power Source" value={settings.powerSource} onChange={(v)=> setSettings({ ...settings, powerSource: v })} />
          <Field label="Solar Battery" value={settings.solarBattery} onChange={(v)=> setSettings({ ...settings, solarBattery: v })} />
        </View>

        <View style={styles.row}>
          <Field label="Heat Lamp" value={settings.heatLamp} onChange={(v)=> setSettings({ ...settings, heatLamp: v })} />
          <Field label="Fan" value={settings.fan} onChange={(v)=> setSettings({ ...settings, fan: v })} />
        </View>

        <View style={styles.row}>
          <Field label="Light" value={settings.light} onChange={(v)=> setSettings({ ...settings, light: v })} />
          <Field label="System Auto Restart" value={settings.systemAutoRestart} onChange={(v)=> setSettings({ ...settings, systemAutoRestart: v })} />
        </View>

        {/* Save Changes Button */}
        <TouchableOpacity style={styles.saveButtonInFlow} onPress={handleSaveChanges}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>

        {/* Bottom spacer for bottom nav */}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* --- Modals --- */}
      {/* 1. Save Changes Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isConfirmModalVisible}
        onRequestClose={handleCancelSave}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContainer}>
            <Icon name="warning" size={35} color="#4CD964" />
            <Text style={styles.modalTitle}>Save Changes?</Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmSave}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelSave}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Successfully Saved Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isSuccessModalVisible}
        onRequestClose={() => setIsSuccessModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContainer}>
            <Icon name="check-circle" size={35} color="#4CD964" />
            <Text style={styles.modalTitle}>Successfully Saved!</Text>
            <Text style={styles.modalMessage}>
              Your changes has been saved successfully.
            </Text>
            <Text style={styles.modalRedirect}>Redirecting to Settings...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// --- Styling ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Assuming a white background for the screen
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  // --- Header ---
  backButton: {
    position: 'absolute',
    top: 18,
    left: 12,
    zIndex: 2,
  },
  topBar: {
    height: 64,
    paddingTop: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontFamily: 'Inter',
    fontWeight: '700',
    fontSize: 22,
    color: '#133E87',
    textAlign: 'center',
  },
  // --- Content layout below title ---
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  field: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 15,
    color: '#0F0F0F',
    marginBottom: 6,
  },
  fieldInput: {
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0000001F',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
  },
  // --- Save Button ---
  saveButtonInFlow: {
    alignSelf: 'center',
    width: 180,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#133E87',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#133E8780',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // --- Modals ---
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Dim the background
  },
  confirmModalContainer: {
    width: 303,
    height: 232,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-around',
    // The top/left absolute positioning for the modal isn't necessary with a flex-based overlay
    // but if needed for strict adherence:
    // position: 'absolute', top: 298, left: 41,
  },
  successModalContainer: {
    width: 303,
    height: 232,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CD964', // Green text color from screenshot
    marginVertical: 10,
  },
  modalMessage: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    marginTop: -20,
  },
  modalRedirect: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
    marginTop: -20,
  },
  confirmButton: {
    width: '80%',
    height: 40,
    backgroundColor: '#FFFFFF', // White background
    borderWidth: 1,
    borderColor: '#4D7ED8',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  confirmButtonText: {
    color: '#4D7ED8',
    fontWeight: '600',
  },
  cancelButton: {
    width: '80%',
    height: 40,
    backgroundColor: '#133E87', // Blue background
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default Settings;