/**
 * Cloud Functions for Firebase - Sensor Data Aggregation
 *
 * This function listens to changes in the Realtime Database under the "sensorData" path.
 * When a new sensor reading is written, it:
 * 1. Identifies the sensor type from the data structure
 * 2. Fetches all values for that sensor type
 * 3. Computes the average
 * 4. Saves the result to Firestore in the "sensorAverages" collection
 *
 * Realtime Database Structure Expected:
 * /sensorData/{userId}/{sensorType}/{timestamp}
 * Example: /sensorData/user123/temperature/1701619200000
 *
 * Each sensor reading should contain:
 * {
 *   value: number,
 *   timestamp: number,
 *   userId: string
 * }
 */

const { onValueWritten } = require("firebase-functions/v2/database");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const {
  getFirestore,
  FieldValue,
  Timestamp,
} = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const nodemailer = require("nodemailer");
const axios = require("axios");

// Load environment variables from .env file (for local development)
require("dotenv").config();

// Import Google Cloud Secret Manager client
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

// Initialize Firebase Admin
initializeApp();

const db = getFirestore();
const rtdb = getDatabase();

// Semaphore API Configuration
const SEMAPHORE_API_URL = "https://semaphore.co/api/v4/messages"; // Use /messages endpoint for custom SMS
const OTP_EXPIRY_MINUTES = 10;

/**
 * Get Semaphore API Key from environment variable
/**
 * Get Semaphore API Key from environment variable or functions config
 * Supports both .env file (local) and Firebase functions.config (production)
 * @returns {string} - Semaphore API key
 */
/**
 * Get Semaphore API Key from Google Secret Manager (production) or .env (local)
 * @returns {Promise<string>} - Semaphore API key
 */
async function getSemaphoreApiKey() {
  // 1. Try Google Secret Manager (production)
  try {
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
      name: "projects/296742448098/secrets/SEMAPHORE_API_KEY/versions/1",
    });
    const apiKey = version.payload.data.toString("utf8");
    if (apiKey) {
      console.log(
        "✅ [SOURCE: Secret Manager] API key fetched from Secret Manager",
      );
      return apiKey;
    }
  } catch (error) {
    console.warn(
      "⚠️ Could not fetch API key from Secret Manager:",
      error.message,
    );
  }

  // 2. Fallback to environment variable (local development)
  if (process.env.SEMAPHORE_API_KEY) {
    console.log("✅ [SOURCE: .env] API key found in environment variables");
    return process.env.SEMAPHORE_API_KEY;
  }

  throw new Error(
    "SEMAPHORE_API_KEY not found in Secret Manager or environment variables",
  );
}

/**
 * Format phone number from international format to local format
 * Converts +639171234567 → 09171234567
 * @param {string} phone - Phone number in any format
 * @returns {string} - Phone number in local format (09XXXXXXXXX)
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;

  // Remove all spaces, dashes, and parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");

  // If it starts with +63, convert to 0 format
  if (cleaned.startsWith("+63")) {
    return "0" + cleaned.substring(3);
  }

  // If it already starts with 09, return as is
  if (cleaned.startsWith("09")) {
    return cleaned;
  }

  // If it starts with 63 (without +), convert to 0 format
  if (cleaned.startsWith("63")) {
    return "0" + cleaned.substring(2);
  }

  return cleaned;
}

/**
 * Generate a random 6-digit OTP
 * @returns {string} - 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Check if OTP has expired
 * @param {Timestamp} createdAt - Timestamp when OTP was created
 * @returns {boolean} - True if expired, false otherwise
 */
function isOTPExpired(createdAt) {
  if (!createdAt) return true;

  const now = new Date();
  const otpAge = (now - createdAt.toDate()) / 1000 / 60; // Age in minutes
  return otpAge > OTP_EXPIRY_MINUTES;
}

/**
 * Send SMS via Semaphore Messages API
 * Uses the /messages endpoint to send custom SMS content
 * @param {string} phoneNumber - Local format phone number (09XXXXXXXXX)
 * @param {string} message - Custom message content to send
 * @returns {Promise<object>} - Semaphore API response
 */
async function sendSemaphoreSMS(phoneNumber, message) {
  try {
    console.log(`📞 Starting sendSemaphoreSMS with phone: ${phoneNumber}`);

    // Ensure phone number is in 09... format for Semaphore
    let localPhone = formatPhoneNumber(phoneNumber);
    console.log(
      `📱 Phone number formatted for Semaphore (local format): ${localPhone}`,
    );

    // Use local format for Semaphore
    const sendPhone = localPhone; // 09XXXXXXXXX format
    console.log(`📱 Will send to: ${sendPhone}`);

    // Get API key from environment variable
    const apiKey = await getSemaphoreApiKey();
    console.log(`✅ API key retrieved successfully`);

    if (!apiKey || apiKey.length === 0) {
      throw new Error("API key is empty or undefined");
    }

    console.log(`📤 Sending POST request to Semaphore Messages API...`);
    console.log(
      `📋 Request details: phone=${sendPhone}, message_length=${message.length}`,
    );

    // Semaphore Messages endpoint requires application/x-www-form-urlencoded format
    const params = new URLSearchParams();
    params.append("apikey", apiKey.trim());
    params.append("number", sendPhone); // Use local format (09XXXXXXXXX)
    params.append("message", message);

    console.log(`📦 Request Parameters:`, {
      apikey: `${apiKey.substring(0, 8)}...`,
      number: sendPhone,
      message: message,
    });

    const response = await axios.post(SEMAPHORE_API_URL, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    console.log(`✅ SMS sent successfully via Semaphore to ${sendPhone}`);
    console.log(`📊 Semaphore Response:`, response.data);

    // Semaphore Messages endpoint returns a message object or array
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log(`✅ Message sent with ID: ${response.data[0].message_id}`);
    } else if (response.data.message_id) {
      console.log(`✅ Message sent with ID: ${response.data.message_id}`);
    }

    return response.data;
  } catch (error) {
    console.error(`❌ Error sending SMS via Semaphore OTP:`, error.message);
    console.error(`📋 Full error stack:`, error);
    if (error.response) {
      console.error(`📋 Semaphore API Error Response:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
    }
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      throw new Error(
        `Network error connecting to Semaphore API: ${error.message}`,
      );
    }
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}

/**
 * Send SMS OTP using Semaphore API
 * Generates OTP, stores it in Firestore, and sends it via Semaphore SMS
 * API key stored as environment variable (SEMAPHORE_API_KEY)
 */
exports.sendSMSOTP = onCall(async (request) => {
  try {
    const { phone } = request.data;

    // Validate input
    if (!phone) {
      throw new HttpsError("invalid-argument", "Phone number is required");
    }

    console.log(`📱 Sending SMS OTP to: ${phone}`);

    // Normalize phone number to local format (09XXXXXXXXX) for database lookup
    const normalizedPhone = formatPhoneNumber(phone);
    console.log(`📱 Normalized phone number: ${normalizedPhone}`);

    // Check if phone number exists in Firestore users collection
    // Check both "mobile" and "phone" fields for compatibility
    let usersSnapshot = await db
      .collection("users")
      .where("mobile", "==", normalizedPhone)
      .limit(1)
      .get();

    // If not found in "mobile" field, try "phone" field with normalized format
    if (usersSnapshot.empty) {
      console.log(
        `⚠️ Phone not found in "mobile" field with ${normalizedPhone}, checking "phone" field...`,
      );
      usersSnapshot = await db
        .collection("users")
        .where("phone", "==", normalizedPhone)
        .limit(1)
        .get();
    }

    // Also try with + prefix format if still not found
    if (usersSnapshot.empty) {
      const internationalPhone = "+63" + normalizedPhone.substring(1);
      console.log(
        `⚠️ Phone not found in "phone" field, checking with international format: ${internationalPhone}...`,
      );
      usersSnapshot = await db
        .collection("users")
        .where("phone", "==", internationalPhone)
        .limit(1)
        .get();
    }

    if (usersSnapshot.empty) {
      console.log(`❌ Phone number not found in database: ${phone}`);
      console.log(`📋 Tried searching for: ${normalizedPhone}`);
      // Log all users for debugging
      const allUsers = await db.collection("users").limit(5).get();
      allUsers.forEach((doc) => {
        console.log(`📋 User ${doc.id}:`, {
          mobile: doc.data().mobile,
          phone: doc.data().phone,
          phoneNumber: doc.data().phoneNumber,
        });
      });
      throw new HttpsError(
        "not-found",
        "Mobile number does not match user records",
      );
    }

    console.log(`✅ Phone number found in database: ${normalizedPhone}`);

    // Generate OTP
    const otp = generateOTP();
    console.log(`📝 Generated OTP: ${otp}`);

    // Store OTP in Firestore for verification
    // Use normalized phone for consistent document IDs
    const otpDocId = `otp_${normalizedPhone.replace(/[+\s\-]/g, "")}`;
    const now = Timestamp.now();
    const expiryTime = new Date(
      now.toDate().getTime() + OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    await db
      .collection("otpVerifications")
      .doc(otpDocId)
      .set(
        {
          phone: normalizedPhone,
          otp: otp,
          createdAt: now,
          expiresAt: Timestamp.fromDate(expiryTime),
          attempts: 0,
          verified: false,
        },
        { merge: true },
      );

    console.log(`✅ OTP stored in Firestore with ID: ${otpDocId}`);

    // Send SMS via Semaphore
    // Use actual generated OTP (not placeholder)
    const message = `Your Internet of Tsiken OTP code is: ${otp}. This code will expire in ${OTP_EXPIRY_MINUTES} minutes.`;

    try {
      await sendSemaphoreSMS(normalizedPhone, message);
    } catch (smsError) {
      console.error(`⚠️ Failed to send SMS: ${smsError.message}`);
      // Delete the OTP record if SMS sending failed
      await db.collection("otpVerifications").doc(otpDocId).delete();
      throw new HttpsError("internal", "Failed to send SMS. Please try again.");
    }

    return {
      success: true,
      phone: phone,
      message: "OTP sent successfully. Check your SMS.",
      expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
    };
  } catch (error) {
    console.error("❌ Error sending SMS OTP:", error);
    // If it's already an HttpsError, throw it as-is
    if (error instanceof HttpsError) {
      throw error;
    }
    // Otherwise, wrap it in an HttpsError
    throw new HttpsError("internal", error.message || "Failed to send SMS OTP");
  }
});

/**
 * Verify SMS OTP using Firestore-based verification
 * Fetches OTP from Firestore, checks match and expiry
 */
exports.verifySMSOTP = onCall(async (request) => {
  try {
    const { phone, otp } = request.data;

    // Validate input
    if (!phone) {
      throw new HttpsError("invalid-argument", "Phone number is required");
    }
    if (!otp) {
      throw new HttpsError("invalid-argument", "OTP code is required");
    }

    console.log(`🔐 Verifying OTP for: ${phone}`);

    // Fetch OTP from Firestore
    const otpDocId = `otp_${phone.replace(/[+\s\-]/g, "")}`;
    const otpDoc = await db.collection("otpVerifications").doc(otpDocId).get();

    if (!otpDoc.exists) {
      console.log(`❌ OTP not found in Firestore for ${phone}`);
      throw new HttpsError(
        "not-found",
        "No OTP found. Please request a new OTP.",
      );
    }

    const otpData = otpDoc.data();

    // Check if OTP has expired
    if (isOTPExpired(otpData.createdAt)) {
      console.log(`❌ OTP expired for ${phone}`);
      // Delete expired OTP
      await db.collection("otpVerifications").doc(otpDocId).delete();
      throw new HttpsError(
        "invalid-argument",
        "OTP has expired. Please request a new OTP.",
      );
    }

    // Check if OTP matches
    if (otpData.otp !== otp) {
      console.log(
        `❌ OTP mismatch for ${phone}. Attempts: ${otpData.attempts + 1}`,
      );

      // Increment attempts
      const newAttempts = (otpData.attempts || 0) + 1;
      const maxAttempts = 5;

      if (newAttempts >= maxAttempts) {
        console.log(`❌ Max OTP attempts exceeded for ${phone}`);
        await db.collection("otpVerifications").doc(otpDocId).delete();
        throw new HttpsError(
          "permission-denied",
          "Maximum verification attempts exceeded. Please request a new OTP.",
        );
      }

      // Update attempts
      await db.collection("otpVerifications").doc(otpDocId).update({
        attempts: newAttempts,
      });

      throw new HttpsError(
        "invalid-argument",
        `Invalid OTP. Ensure the number is correct and try again.`,
      );
    }

    // OTP is valid
    console.log(`✅ OTP verified successfully for ${phone}`);

    // Mark as verified in Firestore
    await db.collection("otpVerifications").doc(otpDocId).update({
      verified: true,
      verifiedAt: Timestamp.now(),
    });

    return {
      success: true,
      phone: phone,
      message: "OTP verified successfully",
    };
  } catch (error) {
    console.error("❌ Error verifying SMS OTP:", error);
    // If it's already an HttpsError, throw it as-is
    if (error instanceof HttpsError) {
      throw error;
    }
    // Otherwise, wrap it in an HttpsError
    throw new HttpsError(
      "internal",
      error.message || "Failed to verify SMS OTP",
    );
  }
});

/**
 * Send Account Email Function
 * Sends credentials to newly created user accounts
 */
exports.sendAccountEmail = onCall(async (request) => {
  try {
    const { email, username, password, firstName } = request.data;

    // Validate input
    if (!email || !username || !password) {
      throw new Error("Missing required fields: email, username, or password");
    }

    // Configure Nodemailer with Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "internetoftsikenapp@gmail.com",
        pass: "rygz gzvk pcvl itpb",
      },
    });

    // Branded HTML Email Template
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Credentials - Internet of Tsiken</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header with Logo -->
                  <tr>
                    <td align="center" style="padding: 40px 20px 20px 20px;">
                      <img src="cid:logo" alt="Internet of Tsiken Logo" style="width: 120px; height: 120px; border-radius: 60px; margin-bottom: 20px;" />
                      <h1 style="margin: 0; color: #133E87; font-size: 28px; font-weight: bold;">Internet of Tsiken</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 20px 40px;">
                      <p style="font-size: 16px; color: #333; margin-bottom: 10px;">Hello ${firstName || "User"},</p>
                      
                      <p style="font-size: 15px; color: #666; line-height: 1.6; margin-bottom: 20px;">
                        Your account has been created successfully. You may now log in using the following credentials:
                      </p>
                      
                      <table width="100%" cellpadding="12" cellspacing="0" style="background-color: #f8f9fa; border-radius: 6px; margin-bottom: 20px;">
                        <tr>
                          <td style="font-size: 15px; color: #333;">
                            <b style="color: #133E87;">Email:</b> ${email}
                          </td>
                        </tr>
                        <tr>
                          <td style="font-size: 15px; color: #333;">
                            <b style="color: #133E87;">Password:</b> ${password}
                          </td>
                        </tr>
                      </table>
                      
                      <p style="font-size: 14px; color: #c41e3a; background-color: #ffebee; padding: 12px; border-left: 4px solid #c41e3a; border-radius: 4px; margin-bottom: 20px;">
                        <b>Security Note:</b> Please keep this information secure and change your password after your first login.
                      </p>
                      
                      <p style="font-size: 14px; color: #666; line-height: 1.6;">
                        If you have any questions or did not request this account, please contact your administrator immediately.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px 40px; background-color: #f8f9fa; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                      <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                        &copy; ${new Date().getFullYear()} Internet of Tsiken. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // Email content with embedded logo
    const mailOptions = {
      from: "Internet of Tsiken <internetoftsikenapp@gmail.com>",
      to: email,
      subject: "Internet of Tsiken - New Account Credentials",
      text: `Hello ${firstName || "User"},

Your account has been created successfully.

Email: ${email}
Password: ${password}

Please keep this information secure and change your password after your first login.

If you have any questions, please contact your administrator.

© ${new Date().getFullYear()} Internet of Tsiken. All rights reserved.`,
      html: htmlBody,
      attachments: [
        {
          filename: "logo.png",
          path: __dirname + "/assets/logo.png", // Path to logo in functions/assets/
          cid: "logo", // Content ID referenced in HTML as cid:logo
        },
      ],
    };

    // Send email
    await transporter.sendMail(mailOptions);

    console.log(`Account email sent successfully to ${email}`);

    return { success: true };
  } catch (error) {
    console.error("Error sending account email:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Create User Account (Admin Only)
 * Creates a new user account without signing them in
 * Allows admins to create accounts without being logged out
 */
exports.createUserAccount = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    try {
      // Verify the caller is an admin
      const callerUid = request.auth?.uid;
      if (!callerUid) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      // Check if caller is admin
      const callerDoc = await db.collection("users").doc(callerUid).get();
      console.log("Caller UID:", callerUid);
      console.log("Caller doc exists:", callerDoc.exists);
      console.log("Caller data:", callerDoc.data());
      console.log("Caller role:", callerDoc.data()?.role);

      if (!callerDoc.exists || callerDoc.data().role !== "admin") {
        console.error(
          "Permission denied - caller role:",
          callerDoc.data()?.role,
        );
        throw new HttpsError(
          "permission-denied",
          "Only administrators can create accounts",
        );
      }

      const {
        email,
        password,
        firstName,
        middleName,
        lastName,
        mobileNumber,
        role,
      } = request.data;

      // Validate required fields
      if (
        !email ||
        !password ||
        !firstName ||
        !lastName ||
        !mobileNumber ||
        !role
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Missing required fields: email, password, firstName, lastName, mobileNumber, or role",
        );
      }

      console.log(`Creating account for: ${email}`);

      // Check if email already exists
      const existingUsers = await db
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!existingUsers.empty) {
        throw new HttpsError("already-exists", "Email already exists");
      }

      // Create Firebase Authentication user (DOES NOT SIGN THEM IN)
      const auth = getAuth();
      const userRecord = await auth.createUser({
        email: email,
        password: password,
        emailVerified: false, // All users start unverified
        disabled: false,
      });

      console.log(`Firebase Auth user created: ${userRecord.uid}`);

      // Create full name
      const fullName = middleName
        ? `${firstName} ${middleName} ${lastName}`
        : `${firstName} ${lastName}`;

      // Use mobileNumber passed from frontend (already formatted as 09XXXXXXXXX)
      // Save to both mobileNumber and phone fields with same value
      const phoneNumber = mobileNumber;

      // Get admin info for logging
      const adminData = callerDoc.data();
      const createdByAdminName =
        adminData.fullname || adminData.displayName || adminData.email;

      // Create Firestore user document
      await db
        .collection("users")
        .doc(userRecord.uid)
        .set({
          uid: userRecord.uid,
          email: email,
          firstName: firstName,
          middleName: middleName || "",
          lastName: lastName,
          fullname: fullName,
          displayName: fullName,
          role: role.toLowerCase(),
          mobileNumber: phoneNumber,
          phone: phoneNumber,
          accountStatus: "active",
          accountType: "standard",
          verified: false,
          phoneVerified: false,
          otpVerified: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: createdByAdminName,
          createdByUid: callerUid,
          failedLoginAttempts: 0,
          failedOtpAttempts: 0,
          mobileVerificationAttempts: 0,
          passwordHistory: [],
          loginHistory: [],
          mustShowPasswordUpdated: false,
          deviceLockUntil: null,
          lastFailedLogin: null,
          lastLoginAttempt: null,
          lastVerified: null,
          lastOTPVerified: null,
          lastMobileVerified: null,
          ipAddress: null,
          userAgent: null,
        });

      console.log(`User profile saved to Firestore: ${userRecord.uid}`);

      // Log activity
      await db
        .collection("activity_logs")
        .doc("userManagement")
        .collection("createAccount")
        .add({
          adminId: callerUid,
          adminName: createdByAdminName,
          action: `Account created for ${fullName} as ${role}`,
          description: `Created new ${role} account for ${fullName} (${email})`,
          timestamp: FieldValue.serverTimestamp(),
          newUserId: userRecord.uid,
          newUserEmail: email,
          newUserName: fullName,
          newUserRole: role.toLowerCase(),
          userId: userRecord.uid,
        });

      console.log(`Account creation logged successfully`);

      return {
        success: true,
        uid: userRecord.uid,
        email: email,
        fullName: fullName,
      };
    } catch (error) {
      console.error("Error creating user account:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        error.message || "Failed to create account",
      );
    }
  },
);

/**
 * Cloud Function triggered when sensor data is written to Realtime Database
 * Path pattern: /sensorData/{userId}/{sensorType}/{timestamp}
 */
exports.calculateSensorAverages = onValueWritten(
  {
    ref: "/sensorData/{userId}/{sensorType}/{timestamp}",
    region: "us-central1", // Change to your preferred region
  },
  async (event) => {
    try {
      // Extract path parameters
      const { userId, sensorType, timestamp } = event.params;

      console.log(
        `Processing sensor data: userId=${userId}, sensorType=${sensorType}, timestamp=${timestamp}`,
      );

      // Get the data that was written
      const newData = event.data.after.val();

      // If data was deleted (null), skip processing
      if (!newData) {
        console.log("Data was deleted, skipping average calculation");
        return null;
      }

      // Fetch all sensor readings for this sensor type and user
      const sensorRef = rtdb.ref(`/sensorData/${userId}/${sensorType}`);
      const snapshot = await sensorRef.once("value");

      if (!snapshot.exists()) {
        console.log(`No data found for sensor type: ${sensorType}`);
        return null;
      }

      // Calculate average from all readings
      const readings = snapshot.val();
      const values = Object.values(readings)
        .filter((reading) => reading && typeof reading.value === "number")
        .map((reading) => reading.value);

      if (values.length === 0) {
        console.log(`No valid numeric values found for ${sensorType}`);
        return null;
      }

      const sum = values.reduce((acc, val) => acc + val, 0);
      const average = sum / values.length;

      console.log(
        `Calculated average for ${sensorType}: ${average} (from ${values.length} readings)`,
      );

      // Save to Firestore sensorAverages collection
      const docRef = db.collection("sensorAverages").doc(sensorType);

      await docRef.set({
        average: parseFloat(average.toFixed(2)), // Round to 2 decimal places
        sensorType: sensorType,
        userId: userId,
        totalReadings: values.length,
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`Successfully saved average for ${sensorType} to Firestore`);

      return {
        success: true,
        sensorType,
        average: average.toFixed(2),
        totalReadings: values.length,
      };
    } catch (error) {
      console.error("Error calculating sensor averages:", error);
      throw error;
    }
  },
);

/**
 * Alternative function for global sensor averages (all users)
 * Path pattern: /sensorData/{userId}/{sensorType}/{timestamp}
 * This calculates averages across ALL users for each sensor type
 */
exports.calculateGlobalSensorAverages = onValueWritten(
  {
    ref: "/sensorData/{userId}/{sensorType}/{timestamp}",
    region: "us-central1",
  },
  async (event) => {
    try {
      const { sensorType } = event.params;

      console.log(`Processing global average for sensor type: ${sensorType}`);

      const newData = event.data.after.val();

      if (!newData) {
        console.log("Data was deleted, skipping global average calculation");
        return null;
      }

      // Fetch all sensor readings for this sensor type across all users
      const allUsersRef = rtdb.ref("/sensorData");
      const snapshot = await allUsersRef.once("value");

      if (!snapshot.exists()) {
        console.log("No sensor data found in database");
        return null;
      }

      const allUserData = snapshot.val();
      const allValues = [];

      // Iterate through all users and collect values for this sensor type
      Object.keys(allUserData).forEach((userId) => {
        const userData = allUserData[userId];
        if (userData[sensorType]) {
          const sensorReadings = userData[sensorType];
          Object.values(sensorReadings).forEach((reading) => {
            if (reading && typeof reading.value === "number") {
              allValues.push(reading.value);
            }
          });
        }
      });

      if (allValues.length === 0) {
        console.log(`No valid values found globally for ${sensorType}`);
        return null;
      }

      const sum = allValues.reduce((acc, val) => acc + val, 0);
      const average = sum / allValues.length;

      console.log(
        `Global average for ${sensorType}: ${average} (from ${allValues.length} readings)`,
      );

      // Save to Firestore with "global_" prefix
      const docRef = db
        .collection("sensorAverages")
        .doc(`global_${sensorType}`);

      await docRef.set({
        average: parseFloat(average.toFixed(2)),
        sensorType: sensorType,
        scope: "global",
        totalReadings: allValues.length,
        minValue: Math.min(...allValues),
        maxValue: Math.max(...allValues),
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`Successfully saved global average for ${sensorType}`);

      return {
        success: true,
        sensorType,
        average: average.toFixed(2),
        totalReadings: allValues.length,
      };
    } catch (error) {
      console.error("Error calculating global sensor averages:", error);
      throw error;
    }
  },
);

/**
 * Multi-sensor type aggregation function
 * Handles multiple sensor types in a single update
 * Path: /sensorData/{userId}/readings/{readingId}
 *
 * Expected data structure:
 * {
 *   temperature: 32,
 *   humidity: 78,
 *   waterLevel: 85,
 *   feedLevel: 62,
 *   solarCharge: 62,
 *   timestamp: 1701619200000
 * }
 */
exports.calculateMultiSensorAverages = onValueWritten(
  {
    ref: "/sensorData/{userId}/readings/{readingId}",
    region: "us-central1",
  },
  async (event) => {
    try {
      const { userId, readingId } = event.params;

      console.log(
        `Processing multi-sensor reading: userId=${userId}, readingId=${readingId}`,
      );

      const newData = event.data.after.val();

      if (!newData) {
        console.log("Data was deleted, skipping processing");
        return null;
      }

      // Define sensor types to process (exclude timestamp and metadata fields)
      const excludedFields = [
        "timestamp",
        "userId",
        "readingId",
        "deviceId",
        "location",
      ];
      const sensorTypes = Object.keys(newData).filter(
        (key) => !excludedFields.includes(key),
      );

      if (sensorTypes.length === 0) {
        console.log("No sensor data fields found");
        return null;
      }

      console.log(`Found ${sensorTypes.length} sensor types:`, sensorTypes);

      // Process each sensor type
      const results = await Promise.all(
        sensorTypes.map(async (sensorType) => {
          try {
            // Fetch all readings for this user
            const readingsRef = rtdb.ref(`/sensorData/${userId}/readings`);
            const snapshot = await readingsRef.once("value");

            if (!snapshot.exists()) {
              return { sensorType, error: "No readings found" };
            }

            const allReadings = snapshot.val();
            const values = Object.values(allReadings)
              .filter(
                (reading) => reading && typeof reading[sensorType] === "number",
              )
              .map((reading) => reading[sensorType]);

            if (values.length === 0) {
              return { sensorType, error: "No valid values" };
            }

            const sum = values.reduce((acc, val) => acc + val, 0);
            const average = sum / values.length;

            // Save to Firestore
            const docRef = db
              .collection("sensorAverages")
              .doc(`${userId}_${sensorType}`);

            await docRef.set({
              average: parseFloat(average.toFixed(2)),
              sensorType: sensorType,
              userId: userId,
              totalReadings: values.length,
              minValue: Math.min(...values),
              maxValue: Math.max(...values),
              updatedAt: FieldValue.serverTimestamp(),
            });

            console.log(
              `Saved average for ${sensorType}: ${average.toFixed(2)}`,
            );

            return {
              sensorType,
              average: average.toFixed(2),
              totalReadings: values.length,
            };
          } catch (error) {
            console.error(`Error processing ${sensorType}:`, error);
            return { sensorType, error: error.message };
          }
        }),
      );

      console.log("Multi-sensor processing complete:", results);

      return {
        success: true,
        userId,
        processedSensors: results.filter((r) => !r.error),
        errors: results.filter((r) => r.error),
      };
    } catch (error) {
      console.error("Error in multi-sensor average calculation:", error);
      throw error;
    }
  },
);
