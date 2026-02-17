# Semaphore Configuration Setup

## Environment Variables Setup

### For Google Cloud Production

#### Step 1: Set API Key in Firebase Functions

```bash
# Navigate to functions directory
cd functions

# Set Semaphore API key
firebase functions:config:set semaphore.api_key="your_actual_api_key_here"

# Verify it's set
firebase functions:config:get
```

#### Step 2: Update functions/index.js to use config

```javascript
// Option 1: Using functions.config() for Firebase
const SEMAPHORE_API_KEY =
  functions.config().semaphore?.api_key || process.env.SEMAPHORE_API_KEY;

// Option 2: Using Google Cloud Secret Manager (Recommended)
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

async function getSemaphoreApiKey() {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${process.env.GCP_PROJECT}/secrets/semaphore-api-key/versions/latest`,
  });
  return version.payload.data.toString("utf8");
}
```

### For Local Development

#### Step 1: Create .env.local file

```bash
# Create file in functions/.env.local
SEMAPHORE_API_KEY=test_your_api_key_here
```

#### Step 2: Update .gitignore

```bash
# Add to .gitignore (if not already there)
.env.local
.env.*.local
.env
```

#### Step 3: Load environment in index.js

```javascript
// At the top of functions/index.js
require("dotenv").config({ path: ".env.local" });

const SEMAPHORE_API_KEY = process.env.SEMAPHORE_API_KEY || "DEFAULT_VALUE";
```

#### Step 4: Install dotenv package

```bash
cd functions
npm install dotenv
```

## Semaphore API Key Setup

### 1. Get Your API Key

1. Log in to [Semaphore Dashboard](https://semaphore.co)
2. Navigate to Settings → API
3. Copy your API Key
4. Store it securely

### 2. Test API Key (Optional)

```bash
curl -X POST "https://api.semaphore.co/api/v4/messages" \
  -d "apikey=YOUR_API_KEY" \
  -d "number=09171234567" \
  -d "message=Test message from Semaphore"
```

### 3. Check Account Balance

```bash
curl "https://semaphore.co/api/v4/account?apikey=YOUR_API_KEY"
```

## Implementation in index.js

### Current Implementation

```javascript
const axios = require("axios");

// Configuration
const SEMAPHORE_API_KEY =
  process.env.SEMAPHORE_API_KEY || "YOUR_SEMAPHORE_API_KEY";
const SEMAPHORE_API_URL = "https://api.semaphore.co/api/v4/messages";

/**
 * Send SMS via Semaphore API
 */
async function sendSemaphoreSMS(phoneNumber, message) {
  try {
    const response = await axios.post(
      SEMAPHORE_API_URL,
      {
        apikey: SEMAPHORE_API_KEY,
        number: phoneNumber,
        message: message,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    console.log(`✅ SMS sent to ${phoneNumber}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error sending SMS:`, error.message);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}
```

## Firestore Security Rules

Add these rules to allow OTP verification operations:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Allow Cloud Functions to read/write OTP verifications
    match /otpVerifications/{document=**} {
      allow read, write: if request.auth != null;
      allow read, write: if request.auth.uid != null;
    }

    // Keep existing rules...
  }
}
```

## Deployment Checklist

- [ ] Semaphore account created
- [ ] API key obtained
- [ ] API key set in Firebase Functions config
- [ ] `axios` dependency added to package.json
- [ ] `Timestamp` imported from firebase-admin/firestore
- [ ] OTP utility functions added
- [ ] `sendSMSOTP` function updated
- [ ] `verifySMSOTP` function updated
- [ ] Firestore collection `otpVerifications` created
- [ ] Frontend imports updated
- [ ] sms-diagnostic.js updated
- [ ] All files deployed
- [ ] Testing completed

## Testing Checklist

### Unit Tests

```javascript
// Test OTP generation
const otp = generateOTP();
console.assert(otp.length === 6, "OTP should be 6 digits");

// Test phone number formatting
const formatted = formatPhoneNumber("+639171234567");
console.assert(formatted === "09171234567", "Phone format incorrect");

// Test OTP expiry
const oldTimestamp = Timestamp.fromDate(new Date(Date.now() - 15 * 60 * 1000));
console.assert(isOTPExpired(oldTimestamp), "Should detect expired OTP");
```

### Integration Tests

1. Request OTP with valid phone number
2. Verify Firestore has OTP record
3. Enter correct OTP code
4. Verify successful message returned
5. Verify OTP marked as verified in Firestore
6. Attempt to use same OTP again (should fail)
7. Test max 5 attempts lockout

### Load Testing

- Test with 100+ concurrent OTP requests
- Monitor Firestore quota
- Monitor Semaphore API limits

## Monitoring & Logs

### View Cloud Functions Logs

```bash
firebase functions:log
```

### Filter by Function

```bash
firebase functions:log --function=sendSMSOTP
```

### Check Semaphore Delivery Status

- Log in to Semaphore Dashboard
- Check Outgoing Messages
- Monitor delivery status (Sent, Delivered, Failed)

## Troubleshooting

### API Key Not Set

```javascript
// Add logging to verify
console.log(
  "API Key set:",
  SEMAPHORE_API_KEY !== "YOUR_SEMAPHORE_API_KEY" ? "✅" : "❌",
);
```

### Firestore Quota Exceeded

- Check Firestore quota in Google Cloud Console
- Implement TTL (Time To Live) for OTP documents
- Archive old OTP records

### SMS Not Sending

1. Check Semaphore credit balance
2. Verify phone number format
3. Check Semaphore API status
4. Review error logs in Firebase

## Cost Tracking

### Estimate Monthly Costs

- Semaphore: ~₱0.50-1.00 per SMS
- Firebase Cloud Functions: ~$0.40 per 1M invocations
- Firestore: ~$0.06 per 100K writes

## Next Steps

1. Get Semaphore API key
2. Set environment variables
3. Deploy Cloud Functions
4. Run integration tests
5. Monitor logs for errors
6. Adjust OTP expiry time if needed
7. Set up alerting for failed SMS sends
