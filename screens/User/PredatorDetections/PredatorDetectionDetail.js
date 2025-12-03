/**
 * PredatorDetectionDetail.js
 * Detail view for a single predator detection with full image and metadata
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../../../config/firebaseconfig";

const { width } = Dimensions.get("window");

const PredatorDetectionDetail = ({ route, navigation }) => {
  const { detection } = route.params;
  const [currentStatus, setCurrentStatus] = useState(detection.status);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (error) {
      return timestamp;
    }
  };

  const getPredatorEmoji = (className) => {
    const emojiMap = {
      cat: "🐱",
      dog: "🐕",
      bird: "🐦",
      bear: "🐻",
      mouse: "🐭",
      snake: "🐍",
      rat: "🐀",
      cow: "🐄",
      horse: "🐴",
    };
    return emojiMap[className.toLowerCase()] || "⚠️";
  };

  const updateStatus = async (newStatus) => {
    try {
      setUpdating(true);
      const detectionRef = doc(db, "predatorDetections", detection.id);
      await updateDoc(detectionRef, {
        status: newStatus,
        lastUpdated: new Date().toISOString(),
      });
      setCurrentStatus(newStatus);
      Alert.alert("Success", `Status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      Alert.alert("Error", "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete Detection",
      "Are you sure you want to delete this detection? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: handleDelete,
        },
      ]
    );
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);

      // Delete image from Firebase Storage
      if (detection.imagePath) {
        try {
          const imageRef = ref(storage, detection.imagePath);
          await deleteObject(imageRef);
        } catch (storageError) {
          console.warn("Image already deleted or not found:", storageError);
        }
      }

      // Delete Firestore document
      await deleteDoc(doc(db, "predatorDetections", detection.id));

      Alert.alert("Success", "Detection deleted successfully", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error("Error deleting detection:", error);
      Alert.alert("Error", "Failed to delete detection");
      setDeleting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "new":
        return "#FF6B6B";
      case "reviewed":
        return "#4CAF50";
      case "false-positive":
        return "#9E9E9E";
      default:
        return "#2196F3";
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detection Details</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={confirmDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#FF6B6B" />
          ) : (
            <Icon name="delete" size={24} color="#FF6B6B" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Full Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: detection.imageUrl }}
            style={styles.fullImage}
            resizeMode="contain"
          />
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(currentStatus) },
            ]}
          >
            <Text style={styles.statusText}>{currentStatus}</Text>
          </View>
        </View>

        {/* Detection Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.emoji}>
              {getPredatorEmoji(detection.detectedClass)}
            </Text>
            <Text style={styles.className}>
              {detection.detectedClass.toUpperCase()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Icon name="verified" size={20} color="#4CAF50" />
            <Text style={styles.infoLabel}>Confidence:</Text>
            <Text style={styles.infoValue}>
              {detection.confidence.toFixed(1)}%
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Icon name="access-time" size={20} color="#2196F3" />
            <Text style={styles.infoLabel}>Detected:</Text>
            <Text style={styles.infoValueSmall}>
              {formatDate(detection.timestamp)}
            </Text>
          </View>

          {detection.fps && (
            <View style={styles.infoRow}>
              <Icon name="speed" size={20} color="#FF9800" />
              <Text style={styles.infoLabel}>FPS:</Text>
              <Text style={styles.infoValue}>{detection.fps.toFixed(1)}</Text>
            </View>
          )}

          {detection.totalDetections > 1 && (
            <View style={styles.infoRow}>
              <Icon name="search" size={20} color="#9C27B0" />
              <Text style={styles.infoLabel}>Total Objects:</Text>
              <Text style={styles.infoValue}>{detection.totalDetections}</Text>
            </View>
          )}

          {detection.serverUrl && (
            <View style={styles.infoRow}>
              <Icon name="camera" size={20} color="#607D8B" />
              <Text style={styles.infoLabel}>Server:</Text>
              <Text style={styles.infoValueSmall} numberOfLines={1}>
                {detection.serverUrl}
              </Text>
            </View>
          )}
        </View>

        {/* Status Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Update Status</Text>

          <TouchableOpacity
            style={[
              styles.actionButton,
              currentStatus === "reviewed" && styles.actionButtonActive,
            ]}
            onPress={() => updateStatus("reviewed")}
            disabled={updating || currentStatus === "reviewed"}
          >
            <Icon
              name="check-circle"
              size={24}
              color={currentStatus === "reviewed" ? "#FFFFFF" : "#4CAF50"}
            />
            <Text
              style={[
                styles.actionButtonText,
                currentStatus === "reviewed" && styles.actionButtonTextActive,
              ]}
            >
              Mark as Reviewed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              currentStatus === "false-positive" && styles.actionButtonActive,
            ]}
            onPress={() => updateStatus("false-positive")}
            disabled={updating || currentStatus === "false-positive"}
          >
            <Icon
              name="cancel"
              size={24}
              color={currentStatus === "false-positive" ? "#FFFFFF" : "#9E9E9E"}
            />
            <Text
              style={[
                styles.actionButtonText,
                currentStatus === "false-positive" &&
                  styles.actionButtonTextActive,
              ]}
            >
              Mark as False Positive
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              currentStatus === "new" && styles.actionButtonActive,
            ]}
            onPress={() => updateStatus("new")}
            disabled={updating || currentStatus === "new"}
          >
            <Icon
              name="fiber-new"
              size={24}
              color={currentStatus === "new" ? "#FFFFFF" : "#FF6B6B"}
            />
            <Text
              style={[
                styles.actionButtonText,
                currentStatus === "new" && styles.actionButtonTextActive,
              ]}
            >
              Mark as New
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

export default PredatorDetectionDetail;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },

  // Header
  topBar: {
    height: 64,
    paddingTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    position: "absolute",
    top: 18,
    left: 12,
    zIndex: 2,
  },
  deleteButton: {
    position: "absolute",
    top: 18,
    right: 12,
    zIndex: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000000",
  },

  // Content
  content: {
    paddingBottom: 20,
  },

  // Image
  imageContainer: {
    width: "100%",
    height: width * 0.9,
    backgroundColor: "#000000",
    position: "relative",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  statusBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  // Info Card
  infoCard: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  emoji: {
    fontSize: 48,
    marginRight: 16,
  },
  className: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: "#666",
    marginLeft: 8,
    marginRight: 8,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  infoValueSmall: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    flex: 1,
  },

  // Actions Card
  actionsCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    marginBottom: 12,
  },
  actionButtonActive: {
    backgroundColor: "#2A59D1",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginLeft: 12,
  },
  actionButtonTextActive: {
    color: "#FFFFFF",
  },
});
