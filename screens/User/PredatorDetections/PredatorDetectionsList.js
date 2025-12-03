/**
 * PredatorDetectionsList.js
 * Screen to display all captured predator detections in a grid/list view
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../../../config/firebaseconfig";
import { ref, deleteObject } from "firebase/storage";
import { storage } from "../../../config/firebaseconfig";

const PredatorDetectionsList = ({ navigation }) => {
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all"); // all, new, reviewed, false-positive

  useEffect(() => {
    fetchDetections();
  }, [filterStatus]);

  const fetchDetections = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "Please log in to view detections");
        return;
      }

      let q = query(
        collection(db, "predatorDetections"),
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc")
      );

      const querySnapshot = await getDocs(q);
      const detectionsList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter by status if not "all"
      const filtered =
        filterStatus === "all"
          ? detectionsList
          : detectionsList.filter((d) => d.status === filterStatus);

      setDetections(filtered);
    } catch (error) {
      console.error("Error fetching detections:", error);
      Alert.alert("Error", "Failed to load detections");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDetections();
  };

  const formatDate = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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

  const renderDetectionCard = (detection) => {
    return (
      <TouchableOpacity
        key={detection.id}
        style={styles.card}
        onPress={() =>
          navigation.navigate("PredatorDetectionDetail", { detection })
        }
      >
        {/* Image */}
        <Image
          source={{ uri: detection.imageUrl }}
          style={styles.cardImage}
          resizeMode="cover"
        />

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(detection.status) },
          ]}
        >
          <Text style={styles.statusText}>
            {detection.status === "false-positive" ? "False" : detection.status}
          </Text>
        </View>

        {/* Info Overlay */}
        <View style={styles.cardOverlay}>
          <Text style={styles.cardEmoji}>
            {getPredatorEmoji(detection.detectedClass)}
          </Text>
          <Text style={styles.cardTitle}>
            {detection.detectedClass.toUpperCase()}
          </Text>
          <Text style={styles.cardConfidence}>
            {detection.confidence.toFixed(1)}% confidence
          </Text>
          <Text style={styles.cardDate}>{formatDate(detection.timestamp)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Predator Detections</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2A59D1" />
          <Text style={styles.loadingText}>Loading detections...</Text>
        </View>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Predator Detections</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {["all", "new", "reviewed", "false-positive"].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterTab,
                filterStatus === status && styles.filterTabActive,
              ]}
              onPress={() => setFilterStatus(status)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterStatus === status && styles.filterTabTextActive,
                ]}
              >
                {status === "false-positive"
                  ? "False Alarms"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Detections Grid */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {detections.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="pets" size={80} color="#CCCCCC" />
            <Text style={styles.emptyText}>No detections found</Text>
            <Text style={styles.emptySubtext}>
              {filterStatus === "all"
                ? "Predator detections will appear here"
                : `No ${filterStatus} detections`}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {detections.map((detection) => renderDetectionCard(detection))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

export default PredatorDetectionsList;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },

  // Header
  topBar: {
    height: 64,
    paddingTop: 18,
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
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000000",
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },

  // Filter
  filterContainer: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
  },
  filterTabActive: {
    backgroundColor: "#2A59D1",
  },
  filterTabText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },

  // Content
  content: {
    padding: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  // Detection Card
  card: {
    width: "48%",
    aspectRatio: 0.75,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 2,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 12,
  },
  cardEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  cardConfidence: {
    fontSize: 12,
    color: "#FFEB3B",
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 10,
    color: "#CCCCCC",
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
  },
});
