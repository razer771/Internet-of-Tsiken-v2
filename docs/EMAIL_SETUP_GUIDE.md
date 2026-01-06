# Email Setup Guide for CreateAccount Feature

## Overview

The CreateAccount screen now sends account credentials via email when a new account is created using Firebase Functions and Nodemailer.

## Setup Instructions

### 1. Generate Gmail App Password

Since Google no longer allows direct password authentication for apps, you need to create an App Password:

1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (enable it if not already)
3. Scroll down to **App passwords**
4. Click **Select app** → Choose "Mail"
5. Click **Select device** → Choose "Other (Custom name)"
6. Enter "Internet of Tsiken" and click **Generate**
7. Copy the 16-character password (it will look like: `xxxx xxxx xxxx xxxx`)

### 2. Configure Firebase Function

Edit `functions/index.js` and replace the placeholders:

```javascript
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your-email@gmail.com", // Replace with your actual Gmail address
    pass: "your-app-password", // Replace with the 16-character App Password
  },
});
```

Also update the `from` field in `mailOptions`:

```javascript
const mailOptions = {
  from: "your-email@gmail.com", // Replace with your Gmail address
  to: email,
  subject: "Your New Account Credentials",
  // ...
};
```

### 3. Deploy Firebase Function

Deploy the function to Firebase:

```bash
cd functions
firebase deploy --only functions:sendAccountEmail
```

Or deploy all functions:

```bash
firebase deploy --only functions
```

### 4. Test the Feature

1. Run your React Native app
2. Navigate to the Admin → Create Account screen
3. Fill in all required fields
4. Click "Save Changes"
5. Check the email inbox for the credentials email

## Email Content

The email sent will contain:

**Subject:** Your New Account Credentials

**Body:**

```
Welcome to Internet of Tsiken!

Your account has been created.

Username: [email address]
Password: [password entered]

Please keep this information secure.
```

## Implementation Details

### Firebase Function (`functions/index.js`)

The `sendAccountEmail` function:

- Accepts `{ email, username, password }` as parameters
- Validates all required fields
- Configures Nodemailer with Gmail SMTP
- Sends a plain text email with credentials
- Returns `{ success: true }` or `{ success: false, error }`

### React Native Integration (`screens/Admin/createAccount.js`)

The `handleSaveChanges` function:

- Validates the form
- Calls the Firebase Function using `httpsCallable`
- Shows success modal regardless of email status
- Logs errors if email sending fails
- Redirects to AdminDashboard after 2.5 seconds

### Success Modal Updates

The modal now displays:

- **Title:** "Account successfully created"
- **Subtitle:** "Credentials sent to user's email"
- **Loading text:** "Redirecting to dashboard..."

## Security Considerations

⚠️ **Important Security Notes:**

1. **Never commit your Gmail App Password to Git**
   - Add `functions/.env` to `.gitignore`
   - Consider using environment variables for production

2. **Use Environment Variables (Recommended for Production)**

   Create `functions/.env`:

   ```
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-app-password
   ```

   Update `functions/index.js`:

   ```javascript
   require("dotenv").config();

   const transporter = nodemailer.createTransport({
     service: "gmail",
     auth: {
       user: process.env.GMAIL_USER,
       pass: process.env.GMAIL_APP_PASSWORD,
     },
   });
   ```

   Install dotenv:

   ```bash
   cd functions
   npm install dotenv
   ```

3. **Password Storage Warning**
   - Sending passwords via email is not recommended for production
   - Consider implementing password reset flow instead
   - Use Firebase Authentication for production apps

## Troubleshooting

### Email not sending

- Verify App Password is correct (no spaces)
- Check Firebase Functions logs: `firebase functions:log`
- Ensure 2-Step Verification is enabled on Gmail
- Check spam/junk folder

### Function deployment fails

- Ensure you're logged in: `firebase login`
- Check Firebase project is initialized: `firebase use --add`
- Verify `functions/package.json` has correct dependencies

### React Native errors

- Ensure Firebase is initialized in your app
- Import getFunctions from correct package
- Check network connectivity

## Alternative Email Services

Instead of Gmail, you can use:

### SendGrid

```javascript
const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 587,
  auth: {
    user: "apikey",
    pass: "your-sendgrid-api-key",
  },
});
```

### AWS SES

```javascript
const transporter = nodemailer.createTransport({
  host: "email-smtp.us-east-1.amazonaws.com",
  port: 587,
  auth: {
    user: "your-aws-ses-smtp-username",
    pass: "your-aws-ses-smtp-password",
  },
});
```

## Next Steps

For production deployment:

1. Use environment variables for credentials
2. Implement rate limiting on the Cloud Function
3. Add email template with HTML formatting
4. Consider using Firebase Authentication instead of manual account creation
5. Implement proper error handling and user notifications
