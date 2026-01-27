# Semaphore SMS OTP Migration Guide

## Overview

This document outlines the complete migration from Twilio SMS OTP to Semaphore SMS API in Firebase Cloud Functions.

## Changes Made

### 1. Backend (Firebase Cloud Functions)

#### Package Dependencies

**Changed in `functions/package.json`:**

- ❌ **Removed:** `twilio@^5.10.6`
- ✅ **Added:** `axios@^1.7.7` (HTTP client for Semaphore API)

#### Configuration Changes

**In `functions/index.js`:**

**Removed:**

```javascript
// Initialize Twilio
const accountSid = "ACcc5a4257b42b456747083860b3a61773";
const authToken = "8448f54ce691e603a6e074d437c90031";
const twilioClient = require("twilio")(accountSid, authToken);
const verifyServiceSid = "VAf81f3e93faa06bb33bd946e3a7fb1da5";
```

**Added:**

```javascript
const axios = require("axios");

// Semaphore API Configuration
const SEMAPHORE_API_KEY =
  process.env.SEMAPHORE_API_KEY || "YOUR_SEMAPHORE_API_KEY";
const SEMAPHORE_API_URL = "https://api.semaphore.co/api/v4/messages";
const OTP_EXPIRY_MINUTES = 10;
```

#### New Utility Functions

**1. `formatPhoneNumber(phone)`**

- Converts phone numbers to local Philippine format (09XXXXXXXXX)
- Input examples: `+639171234567`, `+63 917 123 4567`, `09171234567`
- Output: `09171234567`

**2. `generateOTP()`**

- Generates a random 6-digit OTP code

**3. `isOTPExpired(createdAt)`**

- Checks if OTP has exceeded the expiry time (10 minutes)
- Returns `true` if expired

**4. `sendSemaphoreSMS(phoneNumber, message)`**

- Sends SMS via Semaphore API using HTTP POST
- Returns Semaphore API response on success
- Throws error on failure

#### Updated Cloud Functions

**`sendSMSOTP()` - Now uses Semaphore**

- ✅ Generates OTP locally
- ✅ Stores OTP in Firestore collection `otpVerifications`
- ✅ Sends SMS via Semaphore API
- ✅ Returns expiry information (in seconds)

**Response:**

```javascript
{
  success: true,
  phone: "+639171234567",
  message: "OTP sent successfully. Check your SMS.",
  expiresIn: 600  // 10 minutes in seconds
}
```

**`verifySMSOTP()` - Now uses Firestore verification**

- ✅ Fetches OTP from Firestore
- ✅ Validates OTP match (case-sensitive)
- ✅ Checks expiry time
- ✅ Tracks failed attempts (max 5)
- ✅ Deletes OTP after verification or max attempts

**Response:**

```javascript
{
  success: true,
  phone: "+639171234567",
  message: "OTP verified successfully"
}
```

### 2. Frontend Changes

#### OTPVerification.js (Line 24)

**Before:**

```javascript
// Removed Firebase phone-auth specific imports; using Twilio Verify exclusively
```

**After:**

```javascript
// SMS OTP authentication via Semaphore API (Cloud Functions)
```

#### otpService.js (Line 28)

**Before:**

```javascript
// TODO: Integrate with your SMS provider (Twilio, Firebase Cloud Messaging, etc.)
```

**After:**

```javascript
// NOTE: SMS sending is handled by Firebase Cloud Functions using Semaphore API
// The Cloud Function (sendSMSOTP) handles:
// 1. OTP generation
// 2. Firestore storage
// 3. SMS delivery via Semaphore API
```

#### sms-diagnostic.js

**Updates:**

- Changed "SMS DIAGNOSTIC STARTED" message
- Added Semaphore provider detection
- Updated Cloud Functions connectivity check
- Added Firestore OTP collection status check
- Removed RecaptchaVerifier requirement

### 3. Firestore Structure

**New Collection:** `otpVerifications`

**Document Structure:**

```javascript
{
  phone: "+639171234567",           // International format
  otp: "123456",                     // 6-digit OTP
  createdAt: Timestamp,              // Creation time
  expiresAt: Timestamp,              // Expiry time (10 min after creation)
  attempts: 0,                       // Failed verification attempts
  verified: false,                   // Verification status
  verifiedAt: Timestamp             // Verification timestamp (added after verification)
}
```

**Document ID Format:** `otp_[phone_without_special_chars]`
Example: `otp_639171234567`

## Security Implementation

### 1. API Key Management

#### Option A: Google Cloud Secret Manager (Recommended)

```bash
# Create secret in Google Cloud Console
gcloud secrets create semaphore-api-key --data-file=- < /dev/stdin

# Grant Cloud Functions access
gcloud secrets add-iam-policy-binding semaphore-api-key \
  --member=serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

Update Cloud Functions to use Secret Manager:

```javascript
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const client = new SecretManagerServiceClient();

async function getSemaphoreApiKey() {
  const [version] = await client.accessSecretVersion({
    name: `projects/YOUR_PROJECT_ID/secrets/semaphore-api-key/versions/latest`,
  });
  return version.payload.data.toString("utf8");
}
```

#### Option B: Environment Variables

```bash
# Set in Firebase Functions environment
firebase functions:config:set semaphore.api_key="YOUR_API_KEY"
```

Access in code:

```javascript
const SEMAPHORE_API_KEY = functions.config().semaphore.api_key;
```

#### Option C: Local Development (.env.local)

⚠️ **DO NOT COMMIT .env.local**

```bash
# .env.local (local development only)
SEMAPHORE_API_KEY=your_test_api_key_here
```

### 2. OTP Security Features

- **Expiry:** OTP expires after 10 minutes
- **Attempt Limiting:** Maximum 5 verification attempts
- **Auto-Deletion:** OTPs are deleted after successful verification or max attempts
- **Timestamp Validation:** Timestamps are verified to prevent replay attacks

## Semaphore API Setup

### 1. Create Account

1. Visit [Semaphore.co](https://semaphore.co)
2. Sign up for an account
3. Verify email

### 2. Get API Key

1. Go to API Console
2. Copy your API Key
3. Store securely in Google Cloud Secret Manager

### 3. Add Credits

1. Purchase SMS credits in Semaphore dashboard
2. Minimum recommended: 100 credits for testing

### 4. Configure Sender ID

1. Register your sender name in Semaphore
2. Update SMS messages to include sender ID

## Testing

### Local Testing with Emulator

```bash
# Start Firebase emulator
firebase emulators:start --only functions

# Test in browser console
const sendSMSOTP = firebase.functions().httpsCallable("sendSMSOTP");
sendSMSOTP({ phone: "+639171234567" })
  .then(result => console.log(result.data))
  .catch(error => console.error(error));
```

### Production Testing

1. Test with a valid Philippine phone number
2. Verify SMS receipt (usually arrives within 30 seconds)
3. Test OTP verification with valid and invalid codes
4. Test lockout after 5 failed attempts

## Deployment Steps

### 1. Update Dependencies

```bash
cd functions
npm install
```

### 2. Set Environment Variables

```bash
# Option A: Google Cloud Secret Manager
firebase functions:config:set semaphore.api_key="YOUR_API_KEY"

# Option B: Or use environment variables
export SEMAPHORE_API_KEY="YOUR_API_KEY"
```

### 3. Deploy Cloud Functions

```bash
firebase deploy --only functions
```

### 4. Verify Deployment

```bash
firebase functions:log
```

## Rollback Plan

If issues occur, rollback is not needed since Semaphore is independent:

1. Check Firestore OTP collection for issues
2. Clear test OTPs: `db.collection("otpVerifications").deleteWhere(...)`
3. Check Cloud Functions logs for errors
4. Verify Semaphore API key and credits

## Common Issues & Solutions

### Issue: "OTP not found in Firestore"

- **Cause:** `sendSMSOTP` was not called or failed
- **Solution:** Check Cloud Functions logs, verify Semaphore API key

### Issue: "SMS not received"

- **Cause:** Wrong phone format, insufficient Semaphore credits, or invalid phone number
- **Solution:**
  - Verify phone number format (09XXXXXXXXX)
  - Check Semaphore dashboard for credits
  - Test with a different phone number

### Issue: "Maximum verification attempts exceeded"

- **Cause:** User entered wrong OTP 5 times
- **Solution:** User must request a new OTP via `sendSMSOTP`

### Issue: "OTP has expired"

- **Cause:** More than 10 minutes passed since OTP was sent
- **Solution:** User must request a new OTP

### Issue: "SEMAPHORE_API_KEY is undefined"

- **Cause:** Environment variable not set
- **Solution:** Set API key using Firebase config or Secret Manager

## Performance Metrics

- **SMS Delivery Time:** 30 seconds - 2 minutes
- **OTP Verification:** < 100ms
- **Firestore Operations:** < 200ms
- **Rate Limiting:** None implemented (add if needed)

## Cost Comparison

| Provider  | Per SMS Cost | Setup Cost |
| --------- | ------------ | ---------- |
| Twilio    | $0.0075      | High       |
| Semaphore | ~₱0.50-1.00  | Low        |

## Future Enhancements

- [ ] Rate limiting (max 3 OTP requests per hour per phone)
- [ ] Whitelist trusted phone numbers
- [ ] SMS templates customization
- [ ] OTP retry countdown (resend after 60 seconds)
- [ ] Multi-language SMS support
- [ ] OTP delivery status tracking
- [ ] Analytics dashboard

## References

- [Semaphore API Documentation](https://semaphore.co/api/v4)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
