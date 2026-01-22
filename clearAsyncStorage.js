/**
 * Script to clear AsyncStorage keys
 * Run with: node clearAsyncStorage.js
 */
const AsyncStorage =
  require("@react-native-async-storage/async-storage").default;

async function clearBatchData() {
  try {
    console.log("Clearing batch-related AsyncStorage keys...");

    await Promise.all([
      AsyncStorage.removeItem("batches"),
      AsyncStorage.removeItem("selectedBatchIndex"),
      AsyncStorage.removeItem("chicksCount"),
      AsyncStorage.removeItem("daysCount"),
      AsyncStorage.removeItem("harvestDays"),
      AsyncStorage.removeItem("batchStartDate"),
    ]);

    console.log("✅ All batch data cleared from AsyncStorage");
  } catch (error) {
    console.error("❌ Error clearing AsyncStorage:", error);
  }
}

clearBatchData();
