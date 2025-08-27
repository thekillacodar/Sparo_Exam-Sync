import express from 'express';
import { getAllRows, getRow, runQuery } from '../config/database.js';
import { config } from '../config/environment.js';
import { authenticateToken, requireLecturerOrAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all exams (public - no auth required)
router.get('/', async (req, res) => {
  try {
    const exams = await getAllRows(`
      SELECT
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      ORDER BY e.date ASC, e.time ASC
    `);

    res.json({
      success: true,
      data: exams,
      count: exams.length
    });
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single exam by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await getRow(`
      SELECT
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ?
    `, [id]);

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    console.error('Error fetching exam:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new exam (requires lecturer or admin)
router.post('/', authenticateToken, requireLecturerOrAdmin, async (req, res) => {
  try {
    const { courseCode, courseName, date, time, venue, duration } = req.body;

    // Basic validation
    if (!courseCode || !courseName || !date || !time || !venue || !duration) {
      return res.status(400).json({
        error: 'All fields are required',
        required: ['courseCode', 'courseName', 'date', 'time', 'venue', 'duration']
      });
    }

    // Get user ID from authenticated user
    const createdBy = req.user.id;

    const result = await runQuery(`
      INSERT INTO exams (course_code, course_name, date, time, venue, duration, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [courseCode, courseName, date, time, venue, duration, createdBy]);

    // Fetch the created exam
    const newExam = await getRow(`
      SELECT
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ?
    `, [result.lastID]);

    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      data: newExam
    });
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update exam (requires lecturer or admin)
router.put('/:id', authenticateToken, requireLecturerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { courseCode, courseName, date, time, venue, duration, status } = req.body;

    // Check if exam exists
    const existingExam = await getRow('SELECT id FROM exams WHERE id = ?', [id]);
    if (!existingExam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Update exam
    await runQuery(`
      UPDATE exams
      SET course_code = ?, course_name = ?, date = ?, time = ?, venue = ?, duration = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [courseCode, courseName, date, time, venue, duration, status || 'upcoming', id]);

    // Fetch updated exam
    const updatedExam = await getRow(`
      SELECT
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Exam updated successfully',
      data: updatedExam
    });
  } catch (error) {
    console.error('Error updating exam:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete exam (requires lecturer or admin)
router.delete('/:id', authenticateToken, requireLecturerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if exam exists
    const existingExam = await getRow('SELECT id FROM exams WHERE id = ?', [id]);
    if (!existingExam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Delete exam
    await runQuery('DELETE FROM exams WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Exam deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting exam:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get exams for a specific date range
router.get('/range/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;

    const exams = await getAllRows(`
      SELECT
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.date BETWEEN ? AND ?
      ORDER BY e.date ASC, e.time ASC
    `, [startDate, endDate]);

    res.json({
      success: true,
      data: exams,
      count: exams.length
    });
  } catch (error) {
    console.error('Error fetching exams by date range:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
