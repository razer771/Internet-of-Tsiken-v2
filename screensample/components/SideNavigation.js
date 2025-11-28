import React, { useState } from "react";
import { View, Text, Pressable, TouchableOpacity, StyleSheet, Modal } from "react-native";

export default function SideNavigation({ visible, onClose, navigation }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  if (!visible) return null;

  const menuItems = [
    { label: "Reports", screen: "Reports" },
    { label: "Activity Logs", screen: "ActivityLogs" },
    { label: "User Profile", screen: "UserProfile" },
    { label: "Settings", screen: "Settings" },
  ];

  return (
    <View style={styles.overlay}>

      {/* RIGHT SIDE MENU */}
      <View style={styles.menuBox}>
        <Text style={styles.menuTitle}>Menu</Text>

        {menuItems.map((item, index) => (
          <Pressable
            key={index}
            onPress={() => navigation.navigate(item.screen)}
            style={({ pressed }) => [
              styles.item,
              pressed && { backgroundColor: "#133E87" },
            ]}
          >
            {({ pressed }) => (
              <Text style={[styles.itemText, pressed && { color: "#fff" }]}>
                {item.label}
              </Text>
            )}
          </Pressable>
        ))}

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => setShowLogoutModal(true)}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* CLICK OUTSIDE */}
      <TouchableOpacity style={styles.closeArea} onPress={onClose} />
      
      {/* LOGOUT MODAL */}
      <Modal transparent visible={showLogoutModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Confirm Logout</Text>
            <Text style={styles.modalMessage}>Are you sure you want to log out?</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => {
                  setShowLogoutModal(false);
                  navigation.replace("LoginScreen");
                }}
              >
                <Text style={styles.confirmText}>Log Out</Text>
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    flexDirection: "row-reverse",   // << MOVE MENU TO RIGHT SIDE
    zIndex: 999,
  },

  menuBox: {
    width: 220,
    height: "100%",
    backgroundColor: "#fff",
    padding: 20,
    borderLeftWidth: 1,
    borderColor: "#ddd",

    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: -2, height: 0 },
  },

  closeArea: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
  },

  menuTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },

  item: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 6,
  },

  itemText: {
    fontSize: 17,
    color: "#000",
  },

  logoutButton: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#133E87",
  },

  logoutText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  modalBox: {
    width: 280,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    elevation: 10,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },

  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },

  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },

  cancelText: {
    fontSize: 16,
  },

  confirmBtn: {
    backgroundColor: "#133E87",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },

  confirmText: {
    color: "#fff",
    fontSize: 16,
  },
});
