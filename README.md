# MES - Meal Expense System

## Overview
MES is a web application for managing meal expenses and participants. The application is deployed at [https://mes-ruddy.vercel.app/](https://mes-ruddy.vercel.app/) and supports cross-device login.

## MongoDB Atlas Connection

This application is configured to connect to MongoDB Atlas, a cloud database service. The connection is already set up in the `.env` file with your MongoDB Atlas connection string.

### Connection Details

- The application uses the MongoDB Atlas connection string stored in the `.env` file
- The connection is established when the server starts
- Session data is also stored in MongoDB using connect-mongo

### Testing the Connection

To verify the MongoDB Atlas connection is working:

1. Run the test script:
   ```
   node test-mongodb.js
   ```

2. If successful, you'll see output like:
   ```
   Attempting to connect to MongoDB Atlas...
   Successfully connected to MongoDB Atlas!
   Connection state: 1
   Database name: test
   Connection closed successfully.
   ```

### Troubleshooting Connection Issues

If you encounter connection problems:

1. Verify your MongoDB Atlas cluster is running
2. Check that the connection string in `.env` is correct
3. Ensure your IP address is whitelisted in MongoDB Atlas
4. Check for any network restrictions that might block the connection

## Running the Application

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```
   or for development with auto-restart:
   ```
   npm run dev
   ```

3. Access the application at http://localhost:3001

## Environment Variables

The following environment variables are used:

- `MONGODB_URI`: MongoDB Atlas connection string
- `SESSION_SECRET`: Secret for session encryption
- `PORT`: (Optional) Port to run the server on (defaults to 3001)
- `NODE_ENV`: Set to 'production' in production environments for secure cookies

## Cross-Device Login

The application now supports logging in from different devices:

1. CORS is configured to allow cross-origin requests with credentials
2. Session cookies are configured with appropriate security settings
3. The application is set to trust proxies for secure cookie handling

If you're experiencing login issues across different devices, please ensure:

- You're using the same username and password
- Your browser accepts cookies from the application domain
- You're accessing the application via the deployed URL: [https://mes-ruddy.vercel.app/](https://mes-ruddy.vercel.app/)