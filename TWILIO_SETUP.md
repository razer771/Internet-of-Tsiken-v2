# Twilio SMS OTP Setup Guide

## Problem

The Twilio credentials in the code are invalid, causing "Authentication Error - invalid username" when sending SMS OTP.

## Solution

The code has been updated to use Firebase Secret Manager for secure credential storage.

## Setup Instructions

### 1. Get Valid Twilio Credentials

1. Go to [Twilio Console](https://console.twilio.com/)
2. Sign up for a Twilio account or log in
3. From the dashboard, get:
   - **Account SID** (starts with "AC")
   - **Auth Token** (found under Auth Token section)

### 2. Create a Twilio Verify Service

1. In Twilio Console, go to **Verify** → **Services**
2. Create a new Verify Service
3. Copy the **Service SID** (starts with "VA")

### 3. Set Up Firebase Secrets

Run these commands in your terminal from the project root:

```bash
# Navigate to functions directory
cd functions

# Set Twilio Account SID
firebase functions:secrets:set TWILIO_ACCOUNT_SID

# Set Twilio Auth Token
firebase functions:secrets:set TWILIO_AUTH_TOKEN

# Set Twilio Verify Service SID
firebase functions:secrets:set TWILIO_VERIFY_SERVICE_SID
```

When prompted, paste the corresponding values from your Twilio account.

### 4. Deploy the Functions

```bash
# Deploy the updated functions
firebase deploy --only functions
```

### 5. Grant Access to Secrets (if needed)

If you get permission errors, ensure your Firebase service account has access:

```bash
firebase functions:secrets:access TWILIO_ACCOUNT_SID
firebase functions:secrets:access TWILIO_AUTH_TOKEN
firebase functions:secrets:access TWILIO_VERIFY_SERVICE_SID
```

## Alternative: Use Environment Variables for Local Testing

For local development, you can create a `.env` file in the functions directory:

```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid_here
```

Then update the code to use `process.env` values as fallback during local development.

## Verify Setup

Test the SMS OTP functionality:

1. Run the app
2. Try to verify a phone number
3. Check Firebase Console → Functions → Logs for any errors

## Troubleshooting

### "Authentication Error - invalid username"

- Verify Account SID is correct
- Verify Auth Token is correct and not expired
- Ensure you're using the correct Twilio account

### "Invalid phone number"

- Ensure phone numbers are in E.164 format: `+1234567890`
- For trial accounts, verify the phone number in Twilio Console first

### "Service not found"

- Verify the Verify Service SID is correct
- Ensure the service is active in Twilio Console

## Cost Information

- Twilio charges per SMS sent
- Trial accounts have limitations:
  - Can only send to verified phone numbers
  - Limited credits
- Upgrade to a paid account for production use

## Security Notes

- Never commit Twilio credentials to Git
- Use Firebase Secret Manager for production
- Rotate credentials regularly
- Monitor usage in Twilio Console
