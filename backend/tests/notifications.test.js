import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { jest } from '@jest/globals';

// Mock the database module
jest.mock('../config/database.js', () => ({
  runQuery: jest.fn(),
  getRow: jest.fn(),
  getAllRows: jest.fn(),
  initializeDatabase: jest.fn().mockResolvedValue()
}));

// Mock auth middleware
jest.mock('../middleware/auth.js', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'student' };
    next();
  },
  requireRole: (role) => (req, res, next) => {
    if (req.user.role === role || req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  }
}));

// Import after mocking
import notificationRoutes from '../routes/notifications.js';

const app = express();

// Setup middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/api/notifications', notificationRoutes);

// Import mocked modules
import { runQuery, getRow, getAllRows } from '../config/database.js';

describe('Notifications API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('should return user notifications', async () => {
      const mockNotifications = [
        {
          id: 1,
          user_id: 1,
          title: 'Exam Reminder',
          message: 'Your CS101 exam is tomorrow',
          type: 'reminder',
          is_read: 0,
          created_at: '2024-02-14T10:00:00Z'
        },
        {
          id: 2,
          user_id: 1,
          title: 'Welcome',
          message: 'Welcome to ExamSync!',
          type: 'success',
          is_read: 1,
          created_at: '2024-02-13T10:00:00Z'
        }
      ];

      getAllRows.mockResolvedValue(mockNotifications);

      const response = await request(app)
        .get('/api/notifications');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('title', 'Exam Reminder');
    });

    it('should filter unread notifications', async () => {
      const mockNotifications = [
        {
          id: 1,
          user_id: 1,
          title: 'Exam Reminder',
          message: 'Your CS101 exam is tomorrow',
          type: 'reminder',
          is_read: 0,
          created_at: '2024-02-14T10:00:00Z'
        }
      ];

      getAllRows.mockResolvedValue(mockNotifications);

      const response = await request(app)
        .get('/api/notifications?filter=unread');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should paginate results', async () => {
      const mockNotifications = [
        {
          id: 1,
          user_id: 1,
          title: 'Notification 1',
          message: 'Message 1',
          type: 'info',
          is_read: 0,
          created_at: '2024-02-14T10:00:00Z'
        }
      ];

      getAllRows.mockResolvedValue(mockNotifications);

      const response = await request(app)
        .get('/api/notifications?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/notifications/stats', () => {
    it('should return notification statistics', async () => {
      const mockStats = {
        total: 5,
        unread: 3,
        read: 2,
        byType: {
          reminder: 2,
          success: 1,
          warning: 1,
          info: 1
        }
      };

      getRow.mockResolvedValue({
        total: 5,
        unread: 3,
        read: 2
      });

      getAllRows.mockResolvedValue([
        { type: 'reminder', count: 2 },
        { type: 'success', count: 1 },
        { type: 'warning', count: 1 },
        { type: 'info', count: 1 }
      ]);

      const response = await request(app)
        .get('/api/notifications/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total', 5);
      expect(response.body.data).toHaveProperty('unread', 3);
      expect(response.body.data.byType).toHaveProperty('reminder', 2);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count', async () => {
      getRow.mockResolvedValue({ count: 3 });

      const response = await request(app)
        .get('/api/notifications/unread-count');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('count', 3);
    });
  });

  describe('POST /api/notifications', () => {
    it('should create new notification', async () => {
      const notificationData = {
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info'
      };

      runQuery.mockResolvedValue({ lastID: 1 });

      const response = await request(app)
        .post('/api/notifications')
        .send(notificationData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notification created successfully');
      expect(response.body.data).toHaveProperty('id', 1);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        title: 'Test'
        // Missing message and type
      };

      const response = await request(app)
        .post('/api/notifications')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 1,
        user_id: 1,
        title: 'Test',
        message: 'Test message',
        type: 'info',
        is_read: 0
      };

      getRow.mockResolvedValue(mockNotification);
      runQuery.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .put('/api/notifications/1/read');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notification marked as read');
    });

    it('should return 404 for non-existent notification', async () => {
      getRow.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/notifications/999/read');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Notification not found');
    });
  });

  describe('PUT /api/notifications/bulk/read', () => {
    it('should mark all notifications as read', async () => {
      runQuery.mockResolvedValue({ changes: 3 });

      const response = await request(app)
        .put('/api/notifications/bulk/read');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('All notifications marked as read');
      expect(response.body.data).toHaveProperty('updatedCount', 3);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should delete notification', async () => {
      const mockNotification = {
        id: 1,
        user_id: 1,
        title: 'Test',
        message: 'Test message',
        type: 'info'
      };

      getRow.mockResolvedValue(mockNotification);
      runQuery.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .delete('/api/notifications/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notification deleted successfully');
    });

    it('should return 404 for non-existent notification', async () => {
      getRow.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/notifications/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Notification not found');
    });
  });

  describe('DELETE /api/notifications/all', () => {
    it('should clear all notifications', async () => {
      runQuery.mockResolvedValue({ changes: 5 });

      const response = await request(app)
        .delete('/api/notifications/all');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('All notifications cleared');
      expect(response.body.data).toHaveProperty('deletedCount', 5);
    });
  });

  describe('POST /api/notifications/admin/:userId', () => {
    it('should allow admin to create notification for user', async () => {
      // Mock admin user
      const originalAuthenticateToken = require('../middleware/auth.js').authenticateToken;
      require('../middleware/auth.js').authenticateToken = (req, res, next) => {
        req.user = { id: 1, email: 'admin@example.com', role: 'admin' };
        next();
      };

      const notificationData = {
        title: 'Admin Message',
        message: 'Important announcement',
        type: 'warning'
      };

      runQuery.mockResolvedValue({ lastID: 1 });

      const response = await request(app)
        .post('/api/notifications/admin/2')
        .send(notificationData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notification sent to user');

      // Restore original mock
      require('../middleware/auth.js').authenticateToken = originalAuthenticateToken;
    });

    it('should deny non-admin access', async () => {
      const notificationData = {
        title: 'Test',
        message: 'Test message',
        type: 'info'
      };

      const response = await request(app)
        .post('/api/notifications/admin/2')
        .send(notificationData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });
});
