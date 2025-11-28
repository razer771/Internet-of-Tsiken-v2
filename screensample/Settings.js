// Setting.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import Header from "./components/Header";
import SideNavigation from "./components/SideNavigation";
import BottomNavigation from "./components/BottomNavigation";

// Helper function to handle navigation to the SideNavigation screen
const navigateBack = (navigation) => {
  if (navigation && typeof navigation.navigate === 'function') {
    navigation.navigate('SideNavigation');
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
    temperature: '',
    humidity: '',
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

  /**
   * Helper function to render a label and its associated text input
   * @param {string} label - The label text (e.g., 'Temperature')
   * @param {string} key - The key in the 'settings' state object
   * @param {number} top - The top position of the label
   */
  const renderSettingInput = (label, key, top) => (
    <React.Fragment key={key}>
      {/* Label Text */}
      <Text
        style={[
          styles.textLabel,
          {
            top: top,
            // Left position for the left column (35.2px) and right column (35.2px + 160px for separation)
            left: key.includes('right') ? 35.2 + 160 : 35.2,
          },
        ]}>
        {label}
      </Text>
      {/* Text Input Box */}
      <TextInput
        style={[
          styles.textInput,
          {
            top: top + 27, // Top position of the label + 27px spacing
            // Left position for the left column (40px) and right column (40px + 160px for separation)
            left: key.includes('right') ? 40 + 160 : 40,
          },
        ]}
        value={settings[key]}
        onChangeText={(text) => setSettings({ ...settings, [key]: text })}
      />
    </React.Fragment>
  );

  return (
    <View style={styles.container}>
      {/* Shared app header (logo, menu) */}
      <Header onOpenMenu={() => setIsSideNavVisible(true)} navigation={navigation} />

      {/* Top bar: back arrow (left) + centered title (below shared Header) */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // Open the side navigation drawer when back arrow is pressed
            setIsSideNavVisible(true);
          }}
          accessible={true}
          accessibilityLabel="Open side menu"
        >
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* Side navigation drawer (optional drawer component) */}
      <SideNavigation visible={isSideNavVisible} onClose={() => setIsSideNavVisible(false)} navigation={navigation} />

      {/* --- Setting Inputs --- */}
      {/* Row 1 */}
      {renderSettingInput('Temperature', 'temperature', 121)}
      {renderSettingInput('Humidity', 'humidity_right', 121)}

      {/* Row 2 */}
      {renderSettingInput('Feed', 'feed', 194)}
      {renderSettingInput('Water', 'water_right', 194)}

      {/* Row 3 */}
      {renderSettingInput('Power Source', 'powerSource', 267)}
      {renderSettingInput('Solar Battery', 'solarBattery_right', 267)}

      {/* Row 4 */}
      {renderSettingInput('Heat Lamp', 'heatLamp', 340)}
      {renderSettingInput('Fan', 'fan_right', 340)}

      {/* Row 5 */}
      {renderSettingInput('Light', 'light', 413)}
      {renderSettingInput('System Auto Restart', 'systemAutoRestart_right', 413)}
      {/* --- End Setting Inputs --- */}

      {/* Save Changes Button */}
      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSaveChanges}>
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </TouchableOpacity>

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

      {/* Bottom navigation (fixed) */}
      <BottomNavigation active="Settings" />
    </View>
  );
};

// --- Styling ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Assuming a white background for the screen
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
    fontSize: 20,
    color: '#000000',
    textAlign: 'center',
  },
  // --- Text and Textbox Layout ---
  textLabel: {
    // The exact position is set in renderSettingInput
    // width: 159.409...,
    // height: 18,
    position: 'absolute',
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 15, // 15px
    color: '#0F0F0F', // background: #0F0F0F is likely the text color
  },
  textInput: {
    // The exact position is set in renderSettingInput
    width: 140,
    height: 35,
    position: 'absolute',
    borderRadius: 3, // 3px
    borderWidth: 1, // 1px
    borderColor: '#0000001F',
    backgroundColor: '#FFFFFF', // background: #FFFFFF
    paddingHorizontal: 10,
  },
  // --- Save Button ---
  saveButton: {
    width: 157.21,
    height: 40, // Increased height for better tap target
    position: 'absolute',
    top: 530, // 530px
    left: 118, // 118px
    borderRadius: 10,
    backgroundColor: '#133E87', // Darker blue to match screenshot appearance
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#133E8780',
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