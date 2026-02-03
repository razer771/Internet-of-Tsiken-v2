/**
 * SunsetService.js
 * Utility to fetch sunset time from SunriseSunset.io API
 * for Quezon City, Philippines (lat=14.676, lng=121.043, timezone=Asia/Manila)
 */

/**
 * Fetch sunset time from SunriseSunset.io API
 * @returns {Promise<{success: boolean, sunsetTime?: Date, formattedTime?: string, error?: string}>}
 *
 * @example
 * const result = await fetchSunsetTime();
 * if (result.success) {
 *   console.log("Sunset time:", result.formattedTime); // e.g., "6:15 PM"
 *   console.log("ISO time:", result.sunsetTime);
 * } else {
 *   console.error("Failed to fetch sunset:", result.error);
 * }
 */
export const fetchSunsetTime = async () => {
  try {
    // Quezon City, Philippines coordinates
    const latitude = 14.676;
    const longitude = 121.043;
    const timezone = "Asia/Manila";

    const apiUrl = `https://api.sunrisesunset.io/json?lat=${latitude}&lng=${longitude}&timezone=${timezone}`;

    console.log("[SunsetService] Fetching sunset time from API...");
    console.log("[SunsetService] URL:", apiUrl);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(
        `API responded with status ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log("[SunsetService] API Response:", data);

    // Validate response structure
    if (!data || !data.results || !data.results.sunset) {
      throw new Error("Invalid API response: missing sunset data");
    }

    const sunsetTimeStr = data.results.sunset;
    console.log("[SunsetService] Sunset time string from API:", sunsetTimeStr);

    // Parse the sunset time
    // API returns time already formatted like "5:56:29 PM" in Asia/Manila timezone
    // Extract the AM/PM part
    const isPM = sunsetTimeStr.includes("PM");
    const timeWithoutAMPM = sunsetTimeStr.replace(/\s*(AM|PM)\s*$/i, "");
    const timeParts = timeWithoutAMPM.split(":");
    const hour12 = parseInt(timeParts[0], 10);
    const minuteValue = parseInt(timeParts[1], 10);

    // Convert to 24-hour format for Date object
    let hour24 = hour12;
    if (isPM && hour12 !== 12) {
      hour24 = hour12 + 12;
    } else if (!isPM && hour12 === 12) {
      hour24 = 0;
    }

    const formattedTime = `${hour12}:${String(minuteValue).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;

    // Create a Date object for the ISO timestamp
    const sunsetDate = new Date();
    sunsetDate.setHours(hour24, minuteValue, 0, 0);

    // Format date and time for display (e.g., "Feb 3, 2026 5:56 PM")
    // Get today's date components
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
    const formattedDateTime = `${dateStr} ${formattedTime}`;

    console.log("[SunsetService] Formatted time:", formattedTime);
    console.log("[SunsetService] Formatted date+time:", formattedDateTime);

    return {
      success: true,
      sunsetTime: sunsetDate,
      sunsetTimeIso: sunsetDate.toISOString(),
      formattedTime: formattedTime,
      formattedDateTime: formattedDateTime,
      rawResponse: data,
    };
  } catch (error) {
    console.error("[SunsetService] Error fetching sunset time:", error);

    return {
      success: false,
      error: error.message || "Failed to fetch sunset time",
      errorDetails: error,
    };
  }
};

/**
 * Format sunset time for display
 * @param {Date} date - Date object to format
 * @returns {string} Formatted time (e.g., "6:45 PM")
 */
export const formatSunsetTime = (date) => {
  try {
    if (!date || !(date instanceof Date)) {
      return "N/A";
    }

    const hours = date.getHours();
    const minutes = date.getMinutes();
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? "PM" : "AM";

    return `${hour12}:${String(minutes).padStart(2, "0")} ${ampm}`;
  } catch (error) {
    console.error("[SunsetService] Error formatting sunset time:", error);
    return "N/A";
  }
};

/**
 * Format sunset time with date
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date and time (e.g., "Feb 3, 2026 6:45 PM")
 */
export const formatSunsetDateTime = (date) => {
  try {
    if (!date || !(date instanceof Date)) {
      return "N/A";
    }

    const hours = date.getHours();
    const minutes = date.getMinutes();
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? "PM" : "AM";

    const dateStr = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });

    return `${dateStr} ${hour12}:${String(minutes).padStart(2, "0")} ${ampm}`;
  } catch (error) {
    console.error("[SunsetService] Error formatting sunset date+time:", error);
    return "N/A";
  }
};

/**
 * Test the sunset service with console logging
 * Run this function to verify the API is working correctly
 * Usage: import { testSunsetService } from './SunsetService'; testSunsetService();
 */
export const testSunsetService = async () => {
  console.log("\n=== SUNSET SERVICE TEST ===");
  console.log("Testing SunriseSunset.io API integration...\n");

  const result = await fetchSunsetTime();

  if (result.success) {
    console.log("✅ SUCCESS");
    console.log("Sunset time:", result.formattedTime);
    console.log("Sunset date+time:", result.formattedDateTime);
    console.log("ISO timestamp:", result.sunsetTimeIso);
    console.log("Full API response:", result.rawResponse);
  } else {
    console.log("❌ FAILED");
    console.log("Error:", result.error);
    console.log("Details:", result.errorDetails);
  }

  console.log("\n=== END TEST ===\n");
};
