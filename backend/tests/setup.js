import { jest } from '@jest/globals';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup test environment
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:'; // Use in-memory database for tests
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = 8; // Faster for tests

// Mock Google APIs for testing
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

// Global test utilities
global.testUtils = {
  // Create test user
  createTestUser: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'testpassword123',
    firstName: 'Test',
    lastName: 'User',
    role: 'student',
    isActive: true,
    ...overrides
  }),

  // Create test exam
  createTestExam: (overrides = {}) => ({
    courseCode: 'CS101',
    courseName: 'Introduction to Computer Science',
    date: '2024-02-15',
    time: '10:00',
    venue: 'Room 101',
    duration: 120,
    status: 'upcoming',
    ...overrides
  }),

  // Create test notification
  createTestNotification: (overrides = {}) => ({
    title: 'Test Notification',
    message: 'This is a test notification',
    type: 'info',
    isRead: false,
    ...overrides
  }),

  // Generate JWT token for testing
  generateTestToken: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({
      id: 1,
      email: 'test@example.com',
      role: 'student',
      ...payload
    }, process.env.JWT_SECRET);
  },

  // Clean up database between tests
  cleanupDatabase: async (db) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DELETE FROM notifications', (err) => {
          if (err) reject(err);
        });
        db.run('DELETE FROM exam_conflicts', (err) => {
          if (err) reject(err);
        });
        db.run('DELETE FROM exams', (err) => {
          if (err) reject(err);
        });
        db.run('DELETE FROM users', (err) => {
          if (err) reject(err);
        });
        db.run('DELETE FROM offline_pending_changes', (err) => {
          if (err) reject(err);
        });
        resolve();
      });
    });
  },

  // Setup test data
  setupTestData: async (db) => {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Insert test user
        db.run(
          'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
          ['test@example.com', '$2a$08$hashedpassword', 'Test', 'User', 'student'],
          function(err) {
            if (err) reject(err);

            const userId = this.lastID;

            // Insert test exam
            db.run(
              'INSERT INTO exams (course_code, course_name, date, time, venue, duration, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              ['CS101', 'Computer Science', '2024-02-15', '10:00', 'Room 101', 120, 'upcoming', userId],
              function(err) {
                if (err) reject(err);

                // Insert test notification
                db.run(
                  'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                  [userId, 'Welcome', 'Welcome to ExamSync!', 'success'],
                  function(err) {
                    if (err) reject(err);
                    resolve({ userId, examId: this.lastID, notificationId: this.lastID });
                  }
                );
              }
            );
          }
        );
      });
    });
  }
};

// Setup and teardown
beforeAll(async () => {
  // Create test database directory if it doesn't exist
  const dbDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
});

afterAll(async () => {
  // Clean up test files
  const testDbPath = path.join(__dirname, '../data/exam-sync-test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});
