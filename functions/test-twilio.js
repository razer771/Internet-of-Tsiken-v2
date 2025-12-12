const accountSid = "ACcc5a4257b42b456747083860b3a61773";
const authToken = "8448f54ce691e603a6e074d437c90031";
const client = require("twilio")(accountSid, authToken);

client.verify.v2
  .services("VAf81f3e93faa06bb33bd946e3a7fb1da5")
  .verifications.create({ to: "+639175246023", channel: "sms" })
  .then((verification) => {
    console.log("✅ SMS sent successfully!");
    console.log("Verification SID:", verification.sid);
    console.log("Status:", verification.status);
  })
  .catch((error) => {
    console.error("❌ Error sending SMS:", error.message);
    console.error("Error code:", error.code);
    console.error("Error status:", error.status);
  });
