import { db } from "../config/firebaseconfig";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

/**
 * Compute the updated chicks count for a specific batch
 * by subtracting total mortality from the initial count
 *
 * @param {string} batchId - The batch ID to compute for
 * @param {string} userId - The user ID (optional, for filtering)
 * @returns {Promise<Object>} Object containing batchId, initialCount, totalMortality, and chicksCount
 */
export const computeChicksCount = async (batchId, userId = null) => {
  try {
    // Fetch the brooderInfo document for this batch
    let brooderDoc = null;
    let brooderData = null;

    if (userId) {
      // First try to get by document ID (batchId might be the doc ID)
      try {
        const docRef = doc(db, "brooderInfo", batchId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Verify it belongs to the user
          if (data.userId === userId) {
            brooderDoc = docSnap;
            brooderData = data;
          }
        }
      } catch (e) {
        console.log("Not found by doc ID, trying query...");
      }

      // If not found by ID, query with userId filter
      if (!brooderDoc) {
        const brooderQuery = query(
          collection(db, "brooderInfo"),
          where("userId", "==", userId),
          where("batchId", "==", batchId)
        );
        const brooderSnapshot = await getDocs(brooderQuery);

        if (!brooderSnapshot.empty) {
          brooderDoc = brooderSnapshot.docs[0];
          brooderData = brooderDoc.data();
        }
      }
    } else {
      // If no userId, try to find by document ID
      try {
        const docRef = doc(db, "brooderInfo", batchId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          brooderDoc = docSnap;
          brooderData = docSnap.data();
        }
      } catch (e) {
        console.log("Not found by doc ID");
      }

      // Or query all brooderInfo docs with matching batchId
      if (!brooderDoc) {
        const brooderQuery = query(
          collection(db, "brooderInfo"),
          where("batchId", "==", batchId)
        );
        const brooderSnapshot = await getDocs(brooderQuery);

        if (!brooderSnapshot.empty) {
          brooderDoc = brooderSnapshot.docs[0];
          brooderData = brooderDoc.data();
        }
      }
    }

    if (!brooderDoc || !brooderData) {
      throw new Error(`Batch ${batchId} not found in brooderInfo collection`);
    }

    const initialCount =
      brooderData.chicksCount || brooderData.initialCount || 0;

    // Fetch all mortality logs for this batch
    // Try both the batchId field and the document ID
    const mortalityQuery = query(
      collection(db, "mortality"),
      where("batchId", "==", batchId)
    );

    const mortalitySnapshot = await getDocs(mortalityQuery);

    // Sum up all mortality counts
    let totalMortality = 0;
    mortalitySnapshot.forEach((doc) => {
      const data = doc.data();
      totalMortality += data.mortalityCount || 0;
    });

    // Calculate updated chicks count
    const chicksCount = Math.max(0, initialCount - totalMortality);

    return {
      batchId: batchId,
      initialCount: initialCount,
      totalMortality: totalMortality,
      chicksCount: chicksCount,
    };
  } catch (error) {
    console.error("Error computing chicks count:", error);
    throw error;
  }
};

/**
 * Compute chicks count for multiple batches
 *
 * @param {string} userId - The user ID to filter batches
 * @returns {Promise<Array>} Array of objects containing batch info and updated counts
 */
export const computeAllBatchesChicksCount = async (userId) => {
  try {
    // Fetch all brooderInfo documents for this user
    const brooderQuery = query(
      collection(db, "brooderInfo"),
      where("userId", "==", userId)
    );

    const brooderSnapshot = await getDocs(brooderQuery);

    if (brooderSnapshot.empty) {
      return [];
    }

    // Process each batch
    const results = await Promise.all(
      brooderSnapshot.docs.map(async (brooderDoc) => {
        const brooderData = brooderDoc.data();
        const batchId = brooderData.batchId || brooderDoc.id;

        return await computeChicksCount(batchId, userId);
      })
    );

    return results;
  } catch (error) {
    console.error("Error computing chicks count for all batches:", error);
    throw error;
  }
};

/**
 * Get mortality logs for a specific batch
 *
 * @param {string} batchId - The batch ID
 * @returns {Promise<Array>} Array of mortality log entries
 */
export const getMortalityLogs = async (batchId) => {
  try {
    const mortalityQuery = query(
      collection(db, "mortality"),
      where("batchId", "==", batchId)
    );

    const mortalitySnapshot = await getDocs(mortalityQuery);

    const logs = [];
    mortalitySnapshot.forEach((doc) => {
      logs.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return logs;
  } catch (error) {
    console.error("Error fetching mortality logs:", error);
    throw error;
  }
};
