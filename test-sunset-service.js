/**
 * Test script for SunsetService
 * Run this to verify the sunset API integration works correctly
 *
 * Usage:
 * node test-sunset-service.js
 */

// Simple fetch implementation for Node.js
const testSunsetAPI = async () => {
  console.log("\n=== SUNSET API TEST ===\n");
  console.log("Testing SunriseSunset.io API for Quezon City, Philippines");
  console.log("Coordinates: Latitude 14.676, Longitude 121.043");
  console.log("Timezone: Asia/Manila (GMT+8)\n");

  try {
    const latitude = 14.676;
    const longitude = 121.043;
    const timezone = "Asia/Manila";

    const apiUrl = `https://api.sunrisesunset.io/json?lat=${latitude}&lng=${longitude}&timezone=${timezone}`;
    console.log("API Endpoint:", apiUrl);
    console.log("Fetching...\n");

    const response = await fetch(apiUrl);
    const data = await response.json();

    console.log("✅ API Response received successfully");
    console.log("\nFull Response:", JSON.stringify(data, null, 2));

    if (data && data.results) {
      const sunsetTime = data.results.sunset;
      const sunriseTime = data.results.sunrise;

      console.log("\n📊 Parsed Data:");
      console.log(`  Sunrise: ${sunriseTime}`);
      console.log(`  Sunset: ${sunsetTime}`);
      console.log(`  Date: ${data.results.date}`);

      // Parse sunset time
      const [hours, minutes] = sunsetTime.split(":").map(Number);
      const sunsetDate = new Date();
      sunsetDate.setHours(hours, minutes, 0, 0);

      const formattedTime = sunsetDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const formattedDateTime = sunsetDate.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      console.log("\n🌅 Formatted Output:");
      console.log(`  Time only: ${formattedTime}`);
      console.log(`  Date + Time: ${formattedDateTime}`);
      console.log(`  ISO Format: ${sunsetDate.toISOString()}`);

      console.log("\n✅ SUCCESS - Sunset API integration working correctly!\n");
    } else {
      console.log("\n❌ ERROR - Invalid API response structure\n");
    }
  } catch (error) {
    console.error("\n❌ ERROR - Failed to fetch from API:");
    console.error(error.message);
    console.log("\nTroubleshooting:");
    console.log("1. Check your internet connection");
    console.log("2. Verify the API endpoint is correct");
    console.log("3. Try accessing the URL directly in a browser:");
    console.log(
      "   https://api.sunrisesunset.io/json?lat=14.676&lng=121.043&timezone=Asia/Manila\n",
    );
  }
};

// Run the test
testSunsetAPI();
