// Firebase SMS Diagnostic Tool
// Add this to your OTPVerification.js for debugging

const diagnoseSMSIssue = async (phoneNumber) => {
  console.log("🔍 SMS DIAGNOSTIC STARTED");
  console.log("================================");

  // Check phone number format
  console.log("📱 Phone Number Analysis:");
  console.log(`Input: ${phoneNumber}`);

  const isInternationalFormat = phoneNumber.startsWith("+");
  const hasCountryCode = phoneNumber.length >= 10;
  const isPhilippineNumber =
    phoneNumber.startsWith("+63") || phoneNumber.startsWith("09");

  console.log(
    `✓ International format (+): ${isInternationalFormat ? "✅" : "❌"}`
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
  console.log(
    `Requires RecaptchaVerifier: ${Platform.OS === "web" ? "✅" : "❌"}`
  );

  // Network connectivity
  console.log("\n🌐 Network Status:");
  try {
    const response = await fetch("https://www.google.com", { method: "HEAD" });
    console.log(`Internet connectivity: ${response.ok ? "✅" : "❌"}`);
  } catch (error) {
    console.log(`Internet connectivity: ❌ (${error.message})`);
  }

  // Firebase Functions connectivity
  console.log("\n⚡ Firebase Functions Status:");
  try {
    const testFunction = httpsCallable(functions, "helloWorld");
    const result = await testFunction();
    console.log(`Functions connectivity: ✅`);
    console.log(`Functions response: ${result.data || "OK"}`);
  } catch (error) {
    console.log(`Functions connectivity: ❌ (${error.message})`);
  }

  console.log("\n================================");
  console.log("🔍 SMS DIAGNOSTIC COMPLETED");

  return {
    phoneNumber: correctedNumber,
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
