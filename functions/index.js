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
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

// Initialize Twilio
const accountSid = "ACcc5a4257b42b456747083860b3a61773";
const authToken = "8448f54ce691e603a6e074d437c90031";
const twilioClient = require("twilio")(accountSid, authToken);
const verifyServiceSid = "VAf81f3e93faa06bb33bd946e3a7fb1da5";

// Initialize Firebase Admin
initializeApp();

const db = getFirestore();
const rtdb = getDatabase();

/**
 * Send SMS OTP using Twilio Verify API
 * Sends a verification code via SMS to the provided phone number
 */
exports.sendSMSOTP = onCall(async (request) => {
  try {
    const { phone } = request.data;

    // Validate input
    if (!phone) {
      throw new HttpsError("invalid-argument", "Phone number is required");
    }

    console.log(`📱 Sending SMS OTP to: ${phone}`);

    // Check if phone number exists in Firestore users collection
    const usersSnapshot = await db
      .collection("users")
      .where("mobile", "==", phone)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log(`❌ Phone number not found in database: ${phone}`);
      throw new HttpsError(
        "not-found",
        "Mobile number does not match user records"
      );
    }

    console.log(`✅ Phone number found in database: ${phone}`);

    // Send verification code using Twilio Verify
    const verification = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verifications.create({
        to: phone,
        channel: "sms",
      });

    console.log(`✅ SMS OTP sent successfully. SID: ${verification.sid}`);
    console.log(`Status: ${verification.status}`);

    return {
      success: true,
      phone: phone,
      status: verification.status,
      sid: verification.sid,
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
 * Verify SMS OTP using Twilio Verify API
 * Verifies the OTP code entered by the user
 */
exports.verifySMSOTP = onCall(async (request) => {
  try {
    const { phone, otp } = request.data;

    // Validate input
    if (!phone) {
      throw new Error("Phone number is required");
    }
    if (!otp) {
      throw new Error("OTP code is required");
    }

    console.log(`🔐 Verifying OTP for: ${phone}`);

    // Verify the OTP code using Twilio Verify
    const verificationCheck = await twilioClient.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: phone,
        code: otp,
      });

    console.log(`Verification status: ${verificationCheck.status}`);

    if (verificationCheck.status === "approved") {
      console.log(`✅ OTP verified successfully for ${phone}`);
      return {
        success: true,
        phone: phone,
        status: verificationCheck.status,
      };
    } else {
      console.log(`❌ OTP verification failed for ${phone}`);
      throw new Error("Invalid OTP code");
    }
  } catch (error) {
    console.error("❌ Error verifying SMS OTP:", error);
    throw new Error(error.message || "Failed to verify SMS OTP");
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
        `Processing sensor data: userId=${userId}, sensorType=${sensorType}, timestamp=${timestamp}`
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
        `Calculated average for ${sensorType}: ${average} (from ${values.length} readings)`
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
  }
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
        `Global average for ${sensorType}: ${average} (from ${allValues.length} readings)`
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
  }
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
        `Processing multi-sensor reading: userId=${userId}, readingId=${readingId}`
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
        (key) => !excludedFields.includes(key)
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
                (reading) => reading && typeof reading[sensorType] === "number"
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
              `Saved average for ${sensorType}: ${average.toFixed(2)}`
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
        })
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
  }
);
