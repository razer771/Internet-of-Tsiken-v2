/**
 * PredatorDetectionService.js
 * Service for capturing predator detections from YOLO camera server
 * and saving them to Firebase Storage and Firestore
 */

import { storage, db, auth } from "../config/firebaseconfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, doc, getDoc } from "firebase/firestore";

// Predator classes from YOLO COCO dataset
const PREDATOR_CLASSES = [
  "cat",
  "dog",
  "bird",
  "bear",
  "mouse",
  "snake", // Note: snake might not be in COCO, but we'll check
  "rat",   // Note: rat might be detected as mouse
  "cow",   // Can be dangerous to chickens
  "horse", // Can be dangerous to chickens
];

/**
 * Check if a detected class is a predator
 * @param {string} className - YOLO class name
 * @returns {boolean}
 */
export const isPredator = (className) => {
  return PREDATOR_CLASSES.includes(className.toLowerCase());
};

/**
 * Fetch current detections from the YOLO server
 * @param {string} serverUrl - Base URL of the YOLO server (e.g., "http://192.168.1.100:5000")
 * @returns {Promise<Object>} Detection data
 */
export const fetchDetections = async (serverUrl) => {
  try {
    const response = await fetch(`${serverUrl}/detections`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching detections:", error);
    throw error;
  }
};

/**
 * Capture a snapshot from the YOLO server
 * @param {string} serverUrl - Base URL of the YOLO server
 * @returns {Promise<Blob>} Image blob
 */
export const captureSnapshot = async (serverUrl) => {
  try {
    const response = await fetch(`${serverUrl}/snapshot`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("Error capturing snapshot:", error);
    throw error;
  }
};

/**
 * Upload image to Firebase Storage
 * @param {Blob} imageBlob - Image blob
 * @param {string} userId - User ID
 * @param {string} timestamp - ISO timestamp
 * @returns {Promise<Object>} { url: string, path: string }
 */
export const uploadImage = async (imageBlob, userId, timestamp) => {
  try {
    const filename = `${timestamp.replace(/:/g, "-")}.jpg`;
    const storagePath = `predator_detections/${userId}/${filename}`;
    const storageRef = ref(storage, storagePath);

    // Upload the image
    await uploadBytes(storageRef, imageBlob);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    return {
      url: downloadURL,
      path: storagePath,
    };
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
};

/**
 * Get user info from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { firstName: string, lastName: string }
 */
const getUserInfo = async (userId) => {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      return {
        firstName: userData.firstName || "N/A",
        lastName: userData.lastName || "N/A",
      };
    }
    return { firstName: "N/A", lastName: "N/A" };
  } catch (error) {
    console.error("Error fetching user info:", error);
    return { firstName: "N/A", lastName: "N/A" };
  }
};

/**
 * Save detection metadata to Firestore
 * @param {Object} detectionData - Detection metadata
 * @returns {Promise<string>} Document ID
 */
export const saveDetection = async (detectionData) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    const userInfo = await getUserInfo(user.uid);

    // Save to main predatorDetections collection
    const detectionDoc = await addDoc(collection(db, "predatorDetections"), {
      userId: user.uid,
      userName: user.displayName || user.email || "Unknown User",
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      timestamp: detectionData.timestamp,
      detectedClass: detectionData.detectedClass,
      confidence: detectionData.confidence,
      imageUrl: detectionData.imageUrl,
      imagePath: detectionData.imagePath,
      bbox: detectionData.bbox || null,
      serverUrl: detectionData.serverUrl || null,
      status: "new", // new, reviewed, false-positive
      fps: detectionData.fps || null,
      totalDetections: detectionData.totalDetections || 1,
    });

    // Save to activity logs collection (follows existing pattern)
    await addDoc(collection(db, "predatorDetection_logs"), {
      userId: user.uid,
      userName: user.displayName || user.email || "Unknown User",
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      timestamp: detectionData.timestamp,
      action: "Predator detected",
      description: `Detected ${detectionData.detectedClass} with ${detectionData.confidence}% confidence`,
      detectionId: detectionDoc.id,
      detectedClass: detectionData.detectedClass,
      confidence: detectionData.confidence,
    });

    return detectionDoc.id;
  } catch (error) {
    console.error("Error saving detection:", error);
    throw error;
  }
};

/**
 * Main function to capture and save predator detection
 * @param {string} serverUrl - Base URL of the YOLO server
 * @param {Object} detection - Single detection object from /detections endpoint
 * @returns {Promise<Object>} { success: boolean, detectionId?: string, error?: string }
 */
export const capturePredatorDetection = async (serverUrl, detection = null) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    // If no specific detection provided, fetch current detections
    let targetDetection = detection;
    let allDetectionsData = null;

    if (!targetDetection) {
      allDetectionsData = await fetchDetections(serverUrl);

      // Find first predator in current detections
      const predators = allDetectionsData.objects.filter((obj) =>
        isPredator(obj.class)
      );

      if (predators.length === 0) {
        return { success: false, error: "No predator detected in current frame" };
      }

      // Get highest confidence predator
      targetDetection = predators.reduce((prev, current) =>
        prev.confidence > current.confidence ? prev : current
      );
    }

    // Capture snapshot
    const imageBlob = await captureSnapshot(serverUrl);

    // Upload to Firebase Storage
    const timestamp = new Date().toISOString();
    const uploadResult = await uploadImage(imageBlob, user.uid, timestamp);

    // Prepare detection data
    const detectionData = {
      timestamp,
      detectedClass: targetDetection.class,
      confidence: targetDetection.confidence,
      imageUrl: uploadResult.url,
      imagePath: uploadResult.path,
      bbox: targetDetection.bbox || null,
      serverUrl,
      fps: allDetectionsData?.fps || null,
      totalDetections: allDetectionsData?.count || 1,
    };

    // Save to Firestore
    const detectionId = await saveDetection(detectionData);

    return {
      success: true,
      detectionId,
      detectionData,
    };
  } catch (error) {
    console.error("Error in capturePredatorDetection:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
    };
  }
};

/**
 * Check if current detections contain predators above confidence threshold
 * @param {Object} detectionsData - Data from /detections endpoint
 * @param {number} minConfidence - Minimum confidence threshold (0-100)
 * @returns {Object|null} Highest confidence predator detection or null
 */
export const checkForPredators = (detectionsData, minConfidence = 70) => {
  if (!detectionsData || !detectionsData.objects) {
    return null;
  }

  const predators = detectionsData.objects.filter(
    (obj) => isPredator(obj.class) && obj.confidence >= minConfidence
  );

  if (predators.length === 0) {
    return null;
  }

  // Return highest confidence predator
  return predators.reduce((prev, current) =>
    prev.confidence > current.confidence ? prev : current
  );
};

export default {
  isPredator,
  fetchDetections,
  captureSnapshot,
  uploadImage,
  saveDetection,
  capturePredatorDetection,
  checkForPredators,
};
