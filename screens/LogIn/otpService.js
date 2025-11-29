/**
 * OTP Service
 * Handles OTP generation, sending, and verification
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const OTP_STORAGE_KEY = "otp_data";
const OTP_RESEND_DELAY = 60000; // 60 seconds in milliseconds
const OTP_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Generate a random 6-digit OTP
 * @returns {string} - 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP via SMS (integrate with your SMS provider)
 * @param {string} phoneNumber - Phone number to send OTP to
 * @param {string} otp - OTP to send
 * @returns {Promise<object>} - { success: boolean, error: string }
 */
export const sendOTPViaSMS = async (phoneNumber, otp) => {
  try {
    // TODO: Integrate with your SMS provider (Twilio, Firebase Cloud Messaging, etc.)
    // Example with Firebase Cloud Functions:
    // const response = await fetch('YOUR_CLOUD_FUNCTION_URL', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ phoneNumber, otp })
    // });

    // For now, we'll just log it (remove in production)
    console.log(`OTP sent to ${phoneNumber}: ${otp}`);

    return { success: true, error: null };
  } catch (error) {
    console.error("Error sending OTP:", error);
    return { success: false, error: "Failed to send OTP" };
  }
};

/**
 * Request OTP for a phone number
 * @param {string} phoneNumber - Phone number to send OTP to
 * @returns {Promise<object>} - { success: boolean, otp: string, error: string }
 */
export const requestOTP = async (phoneNumber) => {
  try {
    const otpData = await AsyncStorage.getItem(OTP_STORAGE_KEY);

    if (otpData) {
      const { phoneNumber: storedPhone, lastResendAt } = JSON.parse(otpData);

      // Check if requesting for the same phone number
      if (storedPhone === phoneNumber) {
        const now = Date.now();
        const timeSinceLastResend = now - lastResendAt;

        // Check if 60 seconds have passed since last resend
        if (timeSinceLastResend < OTP_RESEND_DELAY) {
          const remainingTime = Math.ceil(
            (OTP_RESEND_DELAY - timeSinceLastResend) / 1000
          );
          return {
            success: false,
            otp: null,
            error: `Please wait ${remainingTime} seconds before requesting a new OTP`,
            remainingTime,
          };
        }
      }
    }

    // Generate new OTP
    const otp = generateOTP();
    const now = Date.now();

    // Store OTP data
    await AsyncStorage.setItem(
      OTP_STORAGE_KEY,
      JSON.stringify({
        phoneNumber,
        otp,
        createdAt: now,
        lastResendAt: now,
        expiresAt: now + OTP_EXPIRY_TIME,
      })
    );

    // Send OTP via SMS
    const sendResult = await sendOTPViaSMS(phoneNumber, otp);

    if (sendResult.success) {
      return { success: true, otp, error: null };
    } else {
      return { success: false, otp: null, error: sendResult.error };
    }
  } catch (error) {
    console.error("Error requesting OTP:", error);
    return { success: false, otp: null, error: "Failed to request OTP" };
  }
};

/**
 * Verify OTP
 * @param {string} phoneNumber - Phone number OTP was sent to
 * @param {string} enteredOTP - OTP entered by user
 * @returns {Promise<object>} - { success: boolean, error: string }
 */
export const verifyOTP = async (phoneNumber, enteredOTP) => {
  try {
    const otpData = await AsyncStorage.getItem(OTP_STORAGE_KEY);

    if (!otpData) {
      return { success: false, error: "OTP has expired or not requested" };
    }

    const { phoneNumber: storedPhone, otp, expiresAt } = JSON.parse(otpData);
    const now = Date.now();

    // Check if phone number matches
    if (storedPhone !== phoneNumber) {
      return { success: false, error: "Phone number mismatch" };
    }

    // Check if OTP has expired
    if (now > expiresAt) {
      await AsyncStorage.removeItem(OTP_STORAGE_KEY);
      return { success: false, error: "OTP has expired" };
    }

    // Check if OTP matches
    if (otp !== enteredOTP) {
      return { success: false, error: "Incorrect OTP" };
    }

    // Clear OTP data after successful verification
    await AsyncStorage.removeItem(OTP_STORAGE_KEY);

    return { success: true, error: null };
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return { success: false, error: "Failed to verify OTP" };
  }
};

/**
 * Check if OTP can be resent
 * @param {string} phoneNumber - Phone number to check
 * @returns {Promise<object>} - { canResend: boolean, remainingTime: number }
 */
export const checkOTPResendStatus = async (phoneNumber) => {
  try {
    const otpData = await AsyncStorage.getItem(OTP_STORAGE_KEY);

    if (!otpData) {
      return { canResend: true, remainingTime: 0 };
    }

    const { phoneNumber: storedPhone, lastResendAt } = JSON.parse(otpData);

    if (storedPhone !== phoneNumber) {
      return { canResend: true, remainingTime: 0 };
    }

    const now = Date.now();
    const timeSinceLastResend = now - lastResendAt;
    const remainingTime = Math.max(0, OTP_RESEND_DELAY - timeSinceLastResend);

    return {
      canResend: remainingTime === 0,
      remainingTime: Math.ceil(remainingTime / 1000),
    };
  } catch (error) {
    console.error("Error checking OTP resend status:", error);
    return { canResend: true, remainingTime: 0 };
  }
};

/**
 * Clear stored OTP data
 * @returns {Promise<void>}
 */
export const clearOTPData = async () => {
  try {
    await AsyncStorage.removeItem(OTP_STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing OTP data:", error);
  }
};
