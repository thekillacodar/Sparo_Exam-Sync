import express from 'express';
import { google } from 'googleapis';
import { getAllRows, getRow, runQuery } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

// Google Calendar OAuth configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/oauth/callback'
);

// Generate OAuth URL for Google Calendar access
router.get('/oauth/url', authenticateToken, (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    include_granted_scopes: true,
    state: req.user.id // Pass user ID in state
  });

  res.json({
    success: true,
    authorizationUrl,
    message: 'Redirect user to this URL to authorize Google Calendar access'
  });
});

// OAuth callback handler
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      return res.status(400).json({ error: 'Missing authorization code or user ID' });
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store tokens in database (in production, encrypt these)
    await runQuery(
      'UPDATE users SET google_tokens = ?, google_connected = 1 WHERE id = ?',
      [JSON.stringify(tokens), userId]
    );

    // Create notification
    await createNotification(userId, 'google_connected', null, 'Google Calendar connected successfully!');

    res.json({
      success: true,
      message: 'Google Calendar connected successfully!',
      redirectUrl: '/dashboard' // Redirect to dashboard
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Failed to connect Google Calendar' });
  }
});

// Sync exams to Google Calendar
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { examIds = null, syncAll = false } = req.body;

    // Get user's Google tokens
    const user = await getRow('SELECT google_tokens FROM users WHERE id = ?', [userId]);
    if (!user || !user.google_tokens) {
      return res.status(400).json({
        error: 'Google Calendar not connected',
        message: 'Please connect your Google Calendar first',
        action: {
          type: 'connect_calendar',
          url: '/api/calendar/oauth/url'
        }
      });
    }

    // Set up Google Calendar client
    const tokens = JSON.parse(user.google_tokens);
    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get user's primary calendar
    const calendarResponse = await calendar.calendars.get({
      calendarId: 'primary'
    });

    const calendarId = calendarResponse.data.id;

    // Get exams to sync
    let exams;
    if (syncAll) {
      exams = await getAllRows(`
        SELECT * FROM exams
        WHERE status = 'upcoming'
        ORDER BY date ASC, time ASC
      `);
    } else if (examIds && examIds.length > 0) {
      const placeholders = examIds.map(() => '?').join(',');
      exams = await getAllRows(
        `SELECT * FROM exams WHERE id IN (${placeholders})`,
        examIds
      );
    } else {
      return res.status(400).json({ error: 'No exams specified for sync' });
    }

    // Sync each exam to Google Calendar
    const syncResults = [];
    for (const exam of exams) {
      try {
        const result = await syncExamToCalendar(calendar, calendarId, exam, userId);
        syncResults.push(result);
      } catch (error) {
        console.error(`Failed to sync exam ${exam.id}:`, error);
        syncResults.push({
          examId: exam.id,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = syncResults.filter(r => r.success).length;
    const failureCount = syncResults.length - successCount;

    // Create notification
    await createNotification(
      userId,
      'calendar_sync',
      null,
      `Calendar sync completed: ${successCount} success, ${failureCount} failed`
    );

    res.json({
      success: true,
      message: `Synced ${successCount} exams to Google Calendar`,
      results: syncResults,
      summary: {
        total: syncResults.length,
        successful: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    console.error('Calendar sync error:', error);
    res.status(500).json({ error: 'Failed to sync with Google Calendar' });
  }
});

// Remove Google Calendar connection
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await runQuery(
      'UPDATE users SET google_tokens = NULL, google_connected = 0 WHERE id = ?',
      [userId]
    );

    // Create notification
    await createNotification(userId, 'google_disconnected', null, 'Google Calendar disconnected');

    res.json({
      success: true,
      message: 'Google Calendar disconnected successfully'
    });

  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
  }
});

// Get calendar connection status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await getRow('SELECT google_connected FROM users WHERE id = ?', [userId]);

    res.json({
      success: true,
      connected: user.google_connected === 1,
      oauthUrl: user.google_connected === 0 ? '/api/calendar/oauth/url' : null
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check calendar status' });
  }
});

// Auto-sync exams when they are created/updated (optional webhook-style)
router.post('/webhook/sync', async (req, res) => {
  try {
    const { examId, action } = req.body;

    // Get exam details
    const exam = await getRow('SELECT * FROM exams WHERE id = ?', [examId]);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Get all users with Google Calendar connected
    const users = await getAllRows(
      'SELECT id, google_tokens FROM users WHERE google_connected = 1'
    );

    // Sync to each connected user's calendar
    const results = [];
    for (const user of users) {
      try {
        const tokens = JSON.parse(user.google_tokens);
        oauth2Client.setCredentials(tokens);

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const calendarResponse = await calendar.calendars.get({
          calendarId: 'primary'
        });

        const result = await syncExamToCalendar(
          calendar,
          calendarResponse.data.id,
          exam,
          user.id
        );
        results.push({ userId: user.id, ...result });
      } catch (error) {
        console.error(`Failed to sync exam ${examId} for user ${user.id}:`, error);
        results.push({
          userId: user.id,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Auto-synced exam ${examId} to ${results.length} calendars`,
      results
    });

  } catch (error) {
    console.error('Webhook sync error:', error);
    res.status(500).json({ error: 'Failed to auto-sync exam' });
  }
});

// Helper function to sync a single exam to Google Calendar
async function syncExamToCalendar(calendar, calendarId, exam, userId) {
  // Check if event already exists (by exam ID in description)
  const existingEvents = await calendar.events.list({
    calendarId: calendarId,
    q: `ExamSync-${exam.id}`,
    singleEvents: true
  });

  // Prepare event data
  const startDateTime = new Date(`${exam.date}T${exam.time}`);
  const endDateTime = new Date(startDateTime.getTime() + (exam.duration * 60000));

  const eventData = {
    summary: `${exam.course_code} - ${exam.course_name}`,
    description: `ExamSync-${exam.id}\n\nCourse: ${exam.course_code} - ${exam.course_name}\nVenue: ${exam.venue}\nDuration: ${exam.duration} minutes\n\nCreated by ExamSync`,
    location: exam.venue,
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'UTC'
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'UTC'
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 }, // 1 hour before
        { method: 'popup', minutes: 1440 } // 1 day before
      ]
    },
    colorId: getExamColor(exam.status)
  };

  let result;
  if (existingEvents.data.items.length > 0) {
    // Update existing event
    const eventId = existingEvents.data.items[0].id;
    result = await calendar.events.update({
      calendarId: calendarId,
      eventId: eventId,
      resource: eventData
    });

    return {
      examId: exam.id,
      success: true,
      action: 'updated',
      eventId: result.data.id,
      eventUrl: result.data.htmlLink
    };
  } else {
    // Create new event
    result = await calendar.events.insert({
      calendarId: calendarId,
      resource: eventData
    });

    return {
      examId: exam.id,
      success: true,
      action: 'created',
      eventId: result.data.id,
      eventUrl: result.data.htmlLink
    };
  }
}

// Get color ID based on exam status
function getExamColor(status) {
  const colors = {
    'upcoming': '1', // Blue
    'completed': '2', // Green
    'cancelled': '4'  // Red
  };
  return colors[status] || '1';
}

// Get user's calendar events (for viewing/upcoming events)
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    // Get user's Google tokens
    const user = await getRow('SELECT google_tokens FROM users WHERE id = ?', [userId]);
    if (!user || !user.google_tokens) {
      return res.status(400).json({ error: 'Google Calendar not connected' });
    }

    // Set up Google Calendar client
    const tokens = JSON.parse(user.google_tokens);
    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get upcoming events
    const now = new Date();
    const future = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));

    const events = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    // Filter to only show ExamSync events
    const examEvents = events.data.items.filter(event =>
      event.description && event.description.includes('ExamSync-')
    );

    res.json({
      success: true,
      events: examEvents.map(event => ({
        id: event.id,
        title: event.summary,
        start: event.start.dateTime,
        end: event.end.dateTime,
        location: event.location,
        description: event.description,
        url: event.htmlLink
      }))
    });

  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

export default router;
