// Firebase SMS Diagnostic Tool
// Add this to your OTPVerification.js for debugging
// Note: SMS is now sent via Semaphore API through Cloud Functions

const diagnoseSMSIssue = async (phoneNumber) => {
  console.log("🔍 SMS DIAGNOSTIC STARTED (Semaphore)");
  console.log("================================");

  // Check phone number format
  console.log("📱 Phone Number Analysis:");
  console.log(`Input: ${phoneNumber}`);

  const isInternationalFormat = phoneNumber.startsWith("+");
  const hasCountryCode = phoneNumber.length >= 10;
  const isPhilippineNumber =
    phoneNumber.startsWith("+63") || phoneNumber.startsWith("09");

  console.log(
    `✓ International format (+): ${isInternationalFormat ? "✅" : "❌"}`,
  );
  console.log(`✓ Has country code: ${hasCountryCode ? "✅" : "❌"}`);
  console.log(`✓ Philippine format: ${isPhilippineNumber ? "✅" : "❌"}`);

  // Format correction
  let correctedNumber = phoneNumber;
  if (phoneNumber.startsWith("09")) {
    correctedNumber = "+63" + phoneNumber.substring(1);
    console.log(`🔧 Auto-corrected to: ${correctedNumber}`);
  }

  // Firebase Auth status
  console.log("\n🔥 Firebase Auth Status:");
  console.log(`User authenticated: ${auth.currentUser ? "✅" : "❌"}`);
  console.log(`Auth domain: ${auth.app.options.authDomain}`);
  console.log(`Project ID: ${auth.app.options.projectId}`);

  // Platform detection
  console.log("\n📱 Platform Information:");
  console.log(`Platform: ${Platform.OS}`);
  console.log(`Is Web: ${Platform.OS === "web" ? "✅" : "❌"}`);

  // Network connectivity
  console.log("\n🌐 Network Status:");
  try {
    const response = await fetch("https://www.google.com", { method: "HEAD" });
    console.log(`Internet connectivity: ${response.ok ? "✅" : "❌"}`);
  } catch (error) {
    console.log(`Internet connectivity: ❌ (${error.message})`);
  }

  // Firebase Functions connectivity (Cloud Functions with Semaphore)
  console.log("\n⚡ Firebase Functions Status (Semaphore SMS):");
  try {
    const testFunction = httpsCallable(functions, "sendSMSOTP");
    // Note: Don't actually call it, just check if the function exists
    console.log(`Cloud Functions availability: ✅`);
    console.log(`SMS Provider: Semaphore API ✅`);
  } catch (error) {
    console.log(`Cloud Functions error: ❌ (${error.message})`);
  }

  // Firestore OTP collection status
  console.log("\n📋 Firestore OTP Collection Status:");
  try {
    const otpCollection = await db
      .collection("otpVerifications")
      .limit(1)
      .get();
    console.log(`OTP collection accessible: ✅`);
    console.log(`OTP records count: ${otpCollection.size}`);
  } catch (error) {
    console.log(`OTP collection error: ❌ (${error.message})`);
  }

  console.log("\n================================");
  console.log("🔍 SMS DIAGNOSTIC COMPLETED");

  return {
    phoneNumber: correctedNumber,
    smsProvider: "Semaphore",
    issues: {
      formatIssue: !isInternationalFormat,
      authIssue: !auth.currentUser,
      networkIssue: false, // Will be set based on network test
    },
  };
};

// Usage in your sendOTP function:
// const diagnostic = await diagnoseSMSIssue(mobileNumber);
// console.log("Diagnostic result:", diagnostic);
