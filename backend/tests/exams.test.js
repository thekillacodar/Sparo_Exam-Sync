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
  },
  requireLecturerOrAdmin: (req, res, next) => {
    if (req.user.role === 'lecturer' || req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  }
}));

// Mock notifications
jest.mock('../routes/notifications.js', () => ({
  createNotification: jest.fn().mockResolvedValue()
}));

// Import after mocking
import examRoutes from '../routes/exams.js';

const app = express();

// Setup middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/api/exams', examRoutes);

// Import mocked modules
import { runQuery, getRow, getAllRows } from '../config/database.js';
import { createNotification } from '../routes/notifications.js';

describe('Exams API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/exams', () => {
    it('should return all exams', async () => {
      const mockExams = [
        {
          id: 1,
          course_code: 'CS101',
          course_name: 'Computer Science',
          date: '2024-02-15',
          time: '10:00',
          venue: 'Room 101',
          duration: 120,
          status: 'upcoming',
          created_by: 1
        }
      ];

      getAllRows.mockResolvedValue(mockExams);

      const response = await request(app)
        .get('/api/exams');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('course_code', 'CS101');
    });

    it('should handle database errors', async () => {
      getAllRows.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/exams');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch exams');
    });
  });

  describe('GET /api/exams/:id', () => {
    it('should return specific exam', async () => {
      const mockExam = {
        id: 1,
        course_code: 'CS101',
        course_name: 'Computer Science',
        date: '2024-02-15',
        time: '10:00',
        venue: 'Room 101',
        duration: 120,
        status: 'upcoming',
        created_by: 1
      };

      getRow.mockResolvedValue(mockExam);

      const response = await request(app)
        .get('/api/exams/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', 1);
    });

    it('should return 404 for non-existent exam', async () => {
      getRow.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/exams/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Exam not found');
    });
  });

  describe('POST /api/exams', () => {
    it('should create new exam with valid data', async () => {
      const examData = {
        courseCode: 'CS102',
        courseName: 'Data Structures',
        date: '2024-02-20',
        time: '14:00',
        venue: 'Room 201',
        duration: 90,
        status: 'upcoming'
      };

      // Mock no conflicts
      getAllRows.mockResolvedValue([]);
      runQuery.mockResolvedValue({ lastID: 2 });

      const response = await request(app)
        .post('/api/exams')
        .send(examData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Exam created successfully');
      expect(response.body.data).toHaveProperty('id', 2);
    });

    it('should detect and prevent conflicts', async () => {
      const examData = {
        courseCode: 'CS101',
        courseName: 'Computer Science',
        date: '2024-02-15',
        time: '10:00',
        venue: 'Room 101',
        duration: 120,
        status: 'upcoming'
      };

      // Mock time conflict
      const mockConflicts = [{
        id: 1,
        course_code: 'CS101',
        course_name: 'Existing Exam',
        date: '2024-02-15',
        time: '10:00',
        venue: 'Room 101',
        duration: 120
      }];

      getAllRows.mockResolvedValue(mockConflicts);

      const response = await request(app)
        .post('/api/exams')
        .send(examData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Schedule conflict detected');
      expect(response.body.conflicts).toBeDefined();
    });

    it('should validate required fields', async () => {
      const invalidData = {
        courseCode: 'CS101'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/exams')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });
  });

  describe('PUT /api/exams/:id', () => {
    it('should update exam successfully', async () => {
      const updateData = {
        courseCode: 'CS101',
        courseName: 'Updated Course',
        date: '2024-02-16',
        time: '11:00',
        venue: 'Room 102',
        duration: 120,
        status: 'upcoming'
      };

      const existingExam = {
        id: 1,
        course_code: 'CS101',
        course_name: 'Computer Science',
        date: '2024-02-15',
        time: '10:00',
        venue: 'Room 101',
        duration: 120,
        status: 'upcoming',
        created_by: 1
      };

      getRow.mockResolvedValue(existingExam);
      getAllRows.mockResolvedValue([]); // No conflicts
      runQuery.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .put('/api/exams/1')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Exam updated successfully');
    });

    it('should return 404 for non-existent exam', async () => {
      getRow.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/exams/999')
        .send({ courseCode: 'CS101' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Exam not found');
    });
  });

  describe('DELETE /api/exams/:id', () => {
    it('should delete exam successfully', async () => {
      const existingExam = {
        id: 1,
        course_code: 'CS101',
        course_name: 'Computer Science',
        date: '2024-02-15',
        time: '10:00',
        venue: 'Room 101',
        duration: 120,
        status: 'upcoming',
        created_by: 1
      };

      getRow.mockResolvedValue(existingExam);
      runQuery.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .delete('/api/exams/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Exam deleted successfully');
    });

    it('should return 404 for non-existent exam', async () => {
      getRow.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/exams/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Exam not found');
    });
  });

  describe('GET /api/exams/range/:startDate/:endDate', () => {
    it('should return exams in date range', async () => {
      const mockExams = [
        {
          id: 1,
          course_code: 'CS101',
          course_name: 'Computer Science',
          date: '2024-02-15',
          time: '10:00',
          venue: 'Room 101',
          duration: 120,
          status: 'upcoming',
          created_by: 1
        }
      ];

      getAllRows.mockResolvedValue(mockExams);

      const response = await request(app)
        .get('/api/exams/range/2024-02-01/2024-02-28');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should validate date format', async () => {
      const response = await request(app)
        .get('/api/exams/range/invalid-date/2024-02-28');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid date format');
    });
  });

  describe('GET /api/exams/search/:query', () => {
    it('should search exams by course code', async () => {
      const mockExams = [
        {
          id: 1,
          course_code: 'CS101',
          course_name: 'Computer Science',
          date: '2024-02-15',
          time: '10:00',
          venue: 'Room 101',
          duration: 120,
          status: 'upcoming',
          created_by: 1
        }
      ];

      getAllRows.mockResolvedValue(mockExams);

      const response = await request(app)
        .get('/api/exams/search/CS101');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/exams/check-conflicts', () => {
    it('should check for conflicts without conflicts', async () => {
      const examData = {
        courseCode: 'CS101',
        courseName: 'Computer Science',
        date: '2024-02-15',
        time: '10:00',
        venue: 'Room 101',
        duration: 120
      };

      getAllRows.mockResolvedValue([]); // No conflicts

      const response = await request(app)
        .post('/api/exams/check-conflicts')
        .send(examData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.conflicts).toHaveLength(0);
      expect(response.body.message).toBe('No conflicts detected');
    });

    it('should detect conflicts', async () => {
      const examData = {
        courseCode: 'CS101',
        courseName: 'Computer Science',
        date: '2024-02-15',
        time: '10:00',
        venue: 'Room 101',
        duration: 120
      };

      const mockConflicts = [{
        id: 1,
        course_code: 'CS102',
        course_name: 'Data Structures',
        date: '2024-02-15',
        time: '10:00',
        venue: 'Room 101',
        duration: 90
      }];

      getAllRows.mockResolvedValue(mockConflicts);

      const response = await request(app)
        .post('/api/exams/check-conflicts')
        .send(examData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.hasConflicts).toBe(true);
      expect(response.body.conflicts).toHaveLength(1);
    });
  });
});
