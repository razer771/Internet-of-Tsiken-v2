import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";

export default function TimePickerDropdown({ visible, onClose, data, onSelect, title }) {
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.option}
      onPress={() => {
        onSelect(item.value);
        onClose();
      }}
    >
      <Text style={styles.optionText}>{item.value}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            style={styles.list}
            showsVerticalScrollIndicator={true}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "80%",
    maxWidth: 300,
    maxHeight: 400,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeButton: {
    fontSize: 24,
    color: "#64748b",
    fontWeight: "400",
  },
  list: {
    maxHeight: 300,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  optionText: {
    fontSize: 16,
    color: "#1a1a1a",
    fontWeight: "500",
    textAlign: "center",
  },
});
