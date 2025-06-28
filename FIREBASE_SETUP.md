# Firebase Authentication Setup Guide

## Prerequisites
- Firebase project created at https://console.firebase.google.com
- Google Cloud project with Firebase enabled

## Steps to Configure Firebase Authentication

### 1. Get Firebase Web Configuration

1. Go to your Firebase Console: https://console.firebase.google.com
2. Select your project: `mess-3be39`
3. Click on the gear icon (⚙️) next to "Project Overview" to open Project Settings
4. Scroll down to the "Your apps" section
5. If you don't have a web app, click "Add app" and select the web icon (</>)
6. Register your app with a nickname (e.g., "MES Web App")
7. Copy the configuration object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "mess-3be39.firebaseapp.com",
  projectId: "mess-3be39",
  storageBucket: "mess-3be39.appspot.com",
  messagingSenderId: "your-actual-sender-id",
  appId: "your-actual-app-id"
};
```

### 2. Update Firebase Configuration

Replace the placeholder values in `/public/js/firebase-config.js` with your actual Firebase configuration values.

### 3. Enable Google Authentication

1. In Firebase Console, go to "Authentication" in the left sidebar
2. Click on "Sign-in method" tab
3. Click on "Google" provider
4. Enable it and configure:
   - Project support email: your email
   - Authorized domains: add your domain (localhost for development)
5. Save the changes

### 4. Configure Authorized Domains

1. In Authentication > Settings > Authorized domains
2. Add your domains:
   - `localhost` (for development)
   - Your production domain when deployed

### 5. Test the Authentication

1. Start your server: `npm start`
2. Go to `/auth/login` or `/auth/register`
3. Click the "تسجيل الدخول باستخدام جوجل" button
4. You should see a Google sign-in popup
5. After successful authentication, you'll be redirected to the dashboard

## Troubleshooting

### Common Issues:

1. **"Firebase: Error (auth/popup-closed-by-user)"**
   - User closed the popup window
   - This is normal behavior

2. **"Firebase: Error (auth/popup-blocked)"**
   - Browser blocked the popup
   - User needs to allow popups for your site

3. **"Unauthorized: Invalid ID token"**
   - Check that your Firebase Admin SDK service account is properly configured
   - Verify the service account JSON file is in the correct location

4. **"No ID token provided"**
   - Frontend is not sending the token correctly
   - Check browser console for JavaScript errors

### Debug Steps:

1. Open browser developer tools (F12)
2. Check the Console tab for any JavaScript errors
3. Check the Network tab to see if requests to `/auth/authenticate-google` are being made
4. Verify that the Firebase configuration is loaded correctly

## Security Notes

- Never commit your actual Firebase API keys to version control
- Use environment variables for sensitive configuration in production
- The service account JSON file should be kept secure and not exposed publicly
- Consider implementing additional security measures like email verification

## Production Deployment

When deploying to production:

1. Update the authorized domains in Firebase Console
2. Use environment variables for Firebase configuration
3. Ensure HTTPS is enabled (Firebase Auth requires it)
4. Update CORS settings in your server configuration 