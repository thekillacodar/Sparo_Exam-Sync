import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { jest } from '@jest/globals';

// Mock all database and external dependencies
jest.mock('../config/database.js', () => ({
  runQuery: jest.fn(),
  getRow: jest.fn(),
  getAllRows: jest.fn(),
  initializeDatabase: jest.fn().mockResolvedValue()
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedpassword'),
  compare: jest.fn().mockResolvedValue(true)
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ id: 1, email: 'test@example.com', role: 'student' })
}));

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn().mockReturnValue('https://mock-auth-url.com'),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token'
          }
        }),
        setCredentials: jest.fn()
      }))
    },
    calendar: jest.fn().mockReturnValue({
      calendars: {
        get: jest.fn().mockResolvedValue({
          data: { id: 'primary' }
        })
      },
      events: {
        list: jest.fn().mockResolvedValue({
          data: { items: [] }
        }),
        insert: jest.fn().mockResolvedValue({
          data: { id: 'mock-event-id', htmlLink: 'https://mock-calendar-link.com' }
        }),
        update: jest.fn().mockResolvedValue({
          data: { id: 'mock-event-id', htmlLink: 'https://mock-calendar-link.com' }
        })
      }
    })
  }
}));

// Import routes after mocking
import authRoutes from '../routes/auth.js';
import examRoutes from '../routes/exams.js';
import notificationRoutes from '../routes/notifications.js';
import dashboardRoutes from '../routes/dashboard.js';
import exportRoutes from '../routes/export.js';
import calendarRoutes from '../routes/calendar.js';

// Create Express app for integration testing
const app = express();

// Setup middleware
app.use(cors());
app.use(bodyParser.json());

// Mount all routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/calendar', calendarRoutes);

// Import mocked modules
import { runQuery, getRow, getAllRows } from '../config/database.js';

describe('ExamSync Integration Tests', () => {
  let authToken;
  let userId = 1;

  beforeEach(() => {
    jest.clearAllMocks();
    authToken = 'mock-jwt-token';
  });

  describe('Complete User Registration and Login Flow', () => {
    it('should complete full registration and login cycle', async () => {
      // Step 1: Register new user
      const userData = {
        email: 'integration@test.com',
        password: 'testpassword123',
        firstName: 'Integration',
        lastName: 'Test',
        role: 'student'
      };

      // Mock no existing user
      getRow.mockResolvedValueOnce(null);
      runQuery.mockResolvedValueOnce({ lastID: userId });

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data).toHaveProperty('token');

      // Step 2: Login with registered credentials
      const loginData = {
        email: userData.email,
        password: userData.password
      };

      const mockUser = {
        id: userId,
        email: userData.email,
        password_hash: 'hashedpassword',
        first_name: userData.firstName,
        last_name: userData.lastName,
        role: userData.role
      };

      getRow.mockResolvedValueOnce(mockUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data).toHaveProperty('token');

      authToken = loginResponse.body.data.token;

      // Step 3: Verify authentication works
      const verifyResponse = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);
    });
  });

  describe('Exam Management Workflow', () => {
    beforeEach(() => {
      // Mock authenticated user
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        id: userId,
        email: 'test@example.com',
        role: 'student'
      });
    });

    it('should complete exam CRUD workflow', async () => {
      // Step 1: Create new exam
      const examData = {
        courseCode: 'CS101',
        courseName: 'Computer Science Fundamentals',
        date: '2024-02-20',
        time: '10:00',
        venue: 'Room 101',
        duration: 120,
        status: 'upcoming'
      };

      // Mock no conflicts and successful creation
      getAllRows.mockResolvedValueOnce([]); // No conflicts
      runQuery.mockResolvedValueOnce({ lastID: 1 });

      const createResponse = await request(app)
        .post('/api/exams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(examData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);
      const examId = createResponse.body.data.id;

      // Step 2: Retrieve created exam
      const mockExam = {
        id: examId,
        course_code: examData.courseCode,
        course_name: examData.courseName,
        date: examData.date,
        time: examData.time,
        venue: examData.venue,
        duration: examData.duration,
        status: examData.status,
        created_by: userId
      };

      getRow.mockResolvedValueOnce(mockExam);

      const getResponse = await request(app)
        .get(`/api/exams/${examId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.course_code).toBe(examData.courseCode);

      // Step 3: Update exam
      const updateData = {
        ...examData,
        courseName: 'Updated Computer Science',
        venue: 'Room 201'
      };

      getRow.mockResolvedValueOnce(mockExam); // For permission check
      getAllRows.mockResolvedValueOnce([]); // No conflicts
      runQuery.mockResolvedValueOnce({ changes: 1 });

      const updateResponse = await request(app)
        .put(`/api/exams/${examId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);

      // Step 4: List all exams
      getAllRows.mockResolvedValueOnce([mockExam]);

      const listResponse = await request(app)
        .get('/api/exams')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.success).toBe(true);
      expect(listResponse.body.data).toHaveLength(1);
    });
  });

  describe('Notification System Integration', () => {
    beforeEach(() => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        id: userId,
        email: 'test@example.com',
        role: 'student'
      });
    });

    it('should handle complete notification lifecycle', async () => {
      // Step 1: Create notification
      const notificationData = {
        title: 'Exam Reminder',
        message: 'Your CS101 exam is tomorrow at 10:00 AM',
        type: 'reminder'
      };

      runQuery.mockResolvedValueOnce({ lastID: 1 });

      const createResponse = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(notificationData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);

      // Step 2: Get notifications
      const mockNotifications = [{
        id: 1,
        user_id: userId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        is_read: 0,
        created_at: new Date().toISOString()
      }];

      getAllRows.mockResolvedValueOnce(mockNotifications);

      const listResponse = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.success).toBe(true);
      expect(listResponse.body.data).toHaveLength(1);

      // Step 3: Get unread count
      getRow.mockResolvedValueOnce({ count: 1 });

      const countResponse = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`);

      expect(countResponse.status).toBe(200);
      expect(countResponse.body.data.count).toBe(1);

      // Step 4: Mark as read
      getRow.mockResolvedValueOnce(mockNotifications[0]);
      runQuery.mockResolvedValueOnce({ changes: 1 });

      const readResponse = await request(app)
        .put('/api/notifications/1/read')
        .set('Authorization', `Bearer ${authToken}`);

      expect(readResponse.status).toBe(200);
      expect(readResponse.body.success).toBe(true);

      // Step 5: Get stats
      getRow.mockResolvedValueOnce({ total: 1, unread: 0, read: 1 });
      getAllRows.mockResolvedValueOnce([{ type: 'reminder', count: 1 }]);

      const statsResponse = await request(app)
        .get('/api/notifications/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data.unread).toBe(0);
    });
  });

  describe('Dashboard Integration', () => {
    beforeEach(() => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        id: userId,
        email: 'test@example.com',
        role: 'student',
        firstName: 'Test',
        lastName: 'User'
      });
    });

    it('should provide complete dashboard data', async () => {
      // Mock upcoming exams
      const mockUpcomingExams = [
        {
          id: 1,
          course_code: 'CS101',
          course_name: 'Computer Science',
          date: '2024-02-20',
          time: '10:00',
          venue: 'Room 101',
          duration: 120,
          status: 'upcoming'
        }
      ];

      // Mock this week's exams
      const mockThisWeekExams = [
        {
          id: 2,
          course_code: 'MATH101',
          course_name: 'Mathematics',
          date: '2024-02-18',
          time: '14:00',
          venue: 'Room 201',
          duration: 90,
          status: 'upcoming'
        }
      ];

      // Mock recent notifications
      const mockRecentNotifications = [
        {
          id: 1,
          title: 'Exam Reminder',
          message: 'CS101 exam tomorrow',
          type: 'reminder',
          is_read: 0,
          created_at: new Date().toISOString()
        }
      ];

      // Setup all mocks
      getAllRows
        .mockResolvedValueOnce(mockUpcomingExams) // Upcoming exams
        .mockResolvedValueOnce(mockThisWeekExams) // This week's exams
        .mockResolvedValueOnce(mockRecentNotifications); // Recent notifications

      getRow
        .mockResolvedValueOnce({ count: 5 }) // Total exams
        .mockResolvedValueOnce({ count: 3 }) // This week's count
        .mockResolvedValueOnce({ count: 2 }); // Unread notifications

      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data).toHaveProperty('upcomingExams');
      expect(response.body.data).toHaveProperty('thisWeekExams');
      expect(response.body.data).toHaveProperty('recentNotifications');
      expect(response.body.data.stats).toHaveProperty('totalExams', 5);
      expect(response.body.data.stats).toHaveProperty('thisWeekCount', 3);
    });
  });

  describe('Export System Integration', () => {
    beforeEach(() => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        id: userId,
        email: 'test@example.com',
        role: 'student',
        firstName: 'Test',
        lastName: 'User'
      });
    });

    it('should export data in different formats', async () => {
      const mockExams = [
        {
          id: 1,
          course_code: 'CS101',
          course_name: 'Computer Science',
          date: '2024-02-20',
          time: '10:00',
          venue: 'Room 101',
          duration: 120,
          status: 'upcoming',
          created_by_name: 'Test User'
        }
      ];

      getAllRows.mockResolvedValue(mockExams);

      // Test CSV export
      const csvResponse = await request(app)
        .get('/api/export/csv')
        .set('Authorization', `Bearer ${authToken}`);

      expect(csvResponse.status).toBe(200);
      expect(csvResponse.headers['content-type']).toBe('text/csv');
      expect(csvResponse.text).toContain('Course Code,Course Name');

      // Test PDF export
      const pdfResponse = await request(app)
        .get('/api/export/pdf')
        .set('Authorization', `Bearer ${authToken}`);

      expect(pdfResponse.status).toBe(200);
      expect(pdfResponse.headers['content-type']).toBe('application/pdf');
      expect(pdfResponse.text).toContain('ExamSync');
    });
  });

  describe('Conflict Detection Integration', () => {
    beforeEach(() => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        id: userId,
        email: 'test@example.com',
        role: 'student'
      });
    });

    it('should detect and handle exam conflicts', async () => {
      // Step 1: Create first exam
      const exam1Data = {
        courseCode: 'CS101',
        courseName: 'Computer Science',
        date: '2024-02-20',
        time: '10:00',
        venue: 'Room 101',
        duration: 120,
        status: 'upcoming'
      };

      getAllRows.mockResolvedValueOnce([]); // No conflicts
      runQuery.mockResolvedValueOnce({ lastID: 1 });

      await request(app)
        .post('/api/exams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(exam1Data);

      // Step 2: Try to create conflicting exam
      const exam2Data = {
        courseCode: 'CS102',
        courseName: 'Data Structures',
        date: '2024-02-20', // Same date
        time: '10:30', // Overlapping time (10:00-12:00 + 10:30-11:30 = overlap)
        venue: 'Room 101', // Same venue
        duration: 60,
        status: 'upcoming'
      };

      // Mock conflict detection
      const mockConflicts = [{
        id: 1,
        course_code: 'CS101',
        course_name: 'Computer Science',
        date: '2024-02-20',
        time: '10:00',
        venue: 'Room 101',
        duration: 120
      }];

      getAllRows.mockResolvedValueOnce(mockConflicts);

      const conflictCheckResponse = await request(app)
        .post('/api/exams/check-conflicts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(exam2Data);

      expect(conflictCheckResponse.status).toBe(200);
      expect(conflictCheckResponse.body.success).toBe(true);
      expect(conflictCheckResponse.body.hasConflicts).toBe(true);
      expect(conflictCheckResponse.body.conflicts).toHaveLength(1);
    });
  });

  describe('Calendar Integration Workflow', () => {
    beforeEach(() => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        id: userId,
        email: 'test@example.com',
        role: 'student'
      });
    });

    it('should handle Google Calendar integration', async () => {
      // Test OAuth URL generation
      const oauthResponse = await request(app)
        .get('/api/calendar/oauth/url')
        .set('Authorization', `Bearer ${authToken}`);

      expect(oauthResponse.status).toBe(200);
      expect(oauthResponse.body.success).toBe(true);
      expect(oauthResponse.body.authorizationUrl).toContain('https://');

      // Test calendar sync (mock connected state)
      const mockUserWithCalendar = {
        id: userId,
        email: 'test@example.com',
        google_tokens: JSON.stringify({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh'
        }),
        google_connected: 1
      };

      getRow.mockResolvedValue(mockUserWithCalendar);

      const syncData = {
        examIds: [1, 2],
        syncAll: false
      };

      const syncResponse = await request(app)
        .post('/api/calendar/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send(syncData);

      expect(syncResponse.status).toBe(200);
      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.message).toContain('synced');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle authentication errors gracefully', async () => {
      const response = await request(app)
        .get('/api/dashboard');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });

    it('should handle invalid tokens', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should handle database errors', async () => {
      getAllRows.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/exams')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch exams');
    });
  });

  describe('Performance and Load Testing', () => {
    beforeEach(() => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockReturnValue({
        id: userId,
        email: 'test@example.com',
        role: 'student'
      });
    });

    it('should handle multiple concurrent requests', async () => {
      const mockExams = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        course_code: `CS${101 + i}`,
        course_name: `Course ${i + 1}`,
        date: '2024-02-20',
        time: '10:00',
        venue: `Room ${101 + i}`,
        duration: 120,
        status: 'upcoming',
        created_by: userId
      }));

      getAllRows.mockResolvedValue(mockExams);

      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/exams')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(10);
      });
    });

    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        course_code: `CS${101 + i}`,
        course_name: `Course ${i + 1}`,
        date: '2024-02-20',
        time: '10:00',
        venue: `Room ${101 + i}`,
        duration: 120,
        status: 'upcoming',
        created_by: userId
      }));

      getAllRows.mockResolvedValue(largeDataset);

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/exams')
        .set('Authorization', `Bearer ${authToken}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(100);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});
