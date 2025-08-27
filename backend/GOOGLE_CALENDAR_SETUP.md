# Google Calendar Integration Setup

This guide will help you set up Google Calendar integration for ExamSync.

## Prerequisites

1. A Google Cloud Console account
2. A Google Cloud Project (or create a new one)

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: ExamSync
   - User support email: your-email@example.com
   - Developer contact information: your-email@example.com
   - Add scopes: `https://www.googleapis.com/auth/calendar` and `https://www.googleapis.com/auth/calendar.events`
4. Select "Web application" as application type
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/calendar/oauth/callback` (for development)
   - Add your production domain when deploying
6. Click "Create"
7. Copy the Client ID and Client Secret

## Step 3: Configure Environment Variables

Add these variables to your `.env` file in the backend directory:

```env
# Google Calendar API Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/oauth/callback
```

## Step 4: Update Database Schema

Run the migration script to add Google Calendar fields to the users table:

```bash
cd backend
npm run migrate:google-calendar
```

## Step 5: Test the Integration

1. Start your backend server
2. Make a request to get the OAuth URL:
   ```
   GET /api/calendar/oauth/url
   ```
3. Follow the returned authorization URL
4. Grant permissions to access Google Calendar
5. You'll be redirected back to your application

## API Endpoints

### Authentication
- `GET /api/calendar/oauth/url` - Get OAuth authorization URL
- `GET /api/calendar/oauth/callback` - OAuth callback handler
- `DELETE /api/calendar/disconnect` - Disconnect Google Calendar
- `GET /api/calendar/status` - Check connection status

### Synchronization
- `POST /api/calendar/sync` - Sync exams to Google Calendar
  - Body: `{ "examIds": [1, 2, 3], "syncAll": false }`
- `GET /api/calendar/events` - Get calendar events
- `POST /api/calendar/webhook/sync` - Auto-sync webhook (for future use)

## Usage Example

```javascript
// Check connection status
const status = await fetch('/api/calendar/status', {
  headers: { Authorization: `Bearer ${token}` }
});

// If not connected, get OAuth URL
if (!status.connected) {
  const authUrl = await fetch('/api/calendar/oauth/url', {
    headers: { Authorization: `Bearer ${token}` }
  });
  // Redirect user to authUrl.authorizationUrl
}

// Sync exams
const syncResult = await fetch('/api/calendar/sync', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ syncAll: true })
});
```

## Features

- ✅ **OAuth 2.0 Integration**: Secure authentication with Google
- ✅ **One-way Synchronization**: Create/update exam events in Google Calendar
- ✅ **Automatic Reminders**: Set up reminders for exam events
- ✅ **Conflict Prevention**: Avoid duplicate events using unique identifiers
- ✅ **Status Tracking**: Monitor connection and sync status
- ✅ **Error Handling**: Graceful handling of API errors

## Security Notes

- Store Google tokens securely (encrypted in production)
- Use HTTPS in production
- Regularly rotate OAuth credentials
- Implement proper token refresh handling

## Troubleshooting

### Common Issues

1. **"Google Calendar not connected"**
   - User needs to complete OAuth flow
   - Check if tokens are properly stored

2. **"Access denied" errors**
   - Verify Google Calendar API is enabled
   - Check OAuth scopes are correct
   - Ensure redirect URI matches exactly

3. **Token expiration**
   - Google tokens expire and need refresh
   - Implement automatic token refresh

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

## Next Steps

- Implement bidirectional sync (read Google Calendar events)
- Add bulk operations for multiple calendars
- Integrate with Google Workspace domains
- Add calendar sharing and permissions management

For more information, visit the [Google Calendar API documentation](https://developers.google.com/calendar/api).
