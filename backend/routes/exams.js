import express from 'express';
import { getAllRows, getRow, runQuery } from '../config/database.js';
import { config } from '../config/environment.js';
import { authenticateToken, requireLecturerOrAdmin } from '../middleware/auth.js';
import { validateExamData, validateDateRange, validateSearchQuery } from '../middleware/validation.js';

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
router.post('/', authenticateToken, requireLecturerOrAdmin, validateExamData, async (req, res) => {
  try {
    const { courseCode, courseName, date, time, venue, duration } = req.body;

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
router.put('/:id', authenticateToken, requireLecturerOrAdmin, validateExamData, async (req, res) => {
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
router.get('/range/:startDate/:endDate', validateDateRange, async (req, res) => {
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

// Get upcoming exams (next 3 exams for dashboard)
router.get('/upcoming/dashboard', async (req, res) => {
  try {
    const exams = await getAllRows(`
      SELECT
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.date >= date('now')
      ORDER BY e.date ASC, e.time ASC
      LIMIT 3
    `);

    res.json({
      success: true,
      data: exams,
      count: exams.length
    });
  } catch (error) {
    console.error('Error fetching upcoming exams:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get exams for a specific month (for calendar view)
router.get('/calendar/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month) - 1; // JS months are 0-indexed

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 0 || monthNum > 11) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    // Ensure month is 2 digits
    const monthStr = month.padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const endDate = new Date(yearNum, monthNum + 1, 0).toISOString().split('T')[0]; // Last day of month

    const exams = await getAllRows(`
      SELECT
        e.id, e.course_code, e.date, e.time, e.venue, e.status,
        e.course_name, e.duration
      FROM exams e
      WHERE e.date BETWEEN ? AND ?
      ORDER BY e.date ASC, e.time ASC
    `, [startDate, endDate]);

    // Get first day of month and days in month for calendar calculation
    const firstDay = new Date(yearNum, monthNum, 1).getDay();
    const daysInMonth = new Date(yearNum, monthNum + 1, 0).getDate();

    // Group exams by date for easier frontend processing
    const examsByDate = {};
    exams.forEach(exam => {
      const dateKey = exam.date;
      if (!examsByDate[dateKey]) {
        examsByDate[dateKey] = [];
      }
      examsByDate[dateKey].push(exam);
    });

    res.json({
      success: true,
      data: exams,
      examsByDate: examsByDate,
      count: exams.length,
      month: monthStr,
      year: year,
      monthName: new Date(yearNum, monthNum).toLocaleDateString('en-US', { month: 'long' }),
      calendarInfo: {
        firstDay: firstDay,
        daysInMonth: daysInMonth,
        year: yearNum,
        month: monthNum
      }
    });
  } catch (error) {
    console.error('Error fetching calendar exams:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get calendar navigation info (for previous/next month functionality)
router.get('/calendar-nav/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month) - 1; // JS months are 0-indexed

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 0 || monthNum > 11) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    // Calculate previous month
    const prevDate = new Date(yearNum, monthNum - 1, 1);
    const prevMonth = prevDate.getMonth();
    const prevYear = prevDate.getFullYear();

    // Calculate next month
    const nextDate = new Date(yearNum, monthNum + 1, 1);
    const nextMonth = nextDate.getMonth();
    const nextYear = nextDate.getFullYear();

    res.json({
      success: true,
      current: {
        year: yearNum,
        month: monthNum,
        monthName: new Date(yearNum, monthNum).toLocaleDateString('en-US', { month: 'long' }),
        yearDisplay: year
      },
      previous: {
        year: prevYear,
        month: prevMonth,
        monthName: new Date(prevYear, prevMonth).toLocaleDateString('en-US', { month: 'long' }),
        url: `/api/exams/calendar/${prevYear}/${prevMonth + 1}`
      },
      next: {
        year: nextYear,
        month: nextMonth,
        monthName: new Date(nextYear, nextMonth).toLocaleDateString('en-US', { month: 'long' }),
        url: `/api/exams/calendar/${nextYear}/${nextMonth + 1}`
      }
    });
  } catch (error) {
    console.error('Error getting calendar navigation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard statistics
router.get('/stats/dashboard', async (req, res) => {
  try {
    // Get total upcoming exams
    const totalUpcoming = await getRow(`
      SELECT COUNT(*) as count
      FROM exams
      WHERE date >= date('now') AND status = 'upcoming'
    `);

    // Get exams this week
    const thisWeek = await getRow(`
      SELECT COUNT(*) as count
      FROM exams
      WHERE date >= date('now')
      AND date <= date('now', '+6 days')
      AND status = 'upcoming'
    `);

    res.json({
      success: true,
      data: {
        upcomingExams: totalUpcoming.count || 0,
        thisWeekExams: thisWeek.count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search exams by course code or name
router.get('/search/:query', validateSearchQuery, async (req, res) => {
  try {
    const { query } = req.params;
    const searchTerm = `%${query}%`;

    const exams = await getAllRows(`
      SELECT
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.course_code LIKE ? OR e.course_name LIKE ?
      ORDER BY e.date ASC, e.time ASC
    `, [searchTerm, searchTerm]);

    res.json({
      success: true,
      data: exams,
      count: exams.length,
      query: query
    });
  } catch (error) {
    console.error('Error searching exams:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get exams by venue
router.get('/venue/:venue', async (req, res) => {
  try {
    const { venue } = req.params;
    const venuePattern = `%${venue}%`;

    const exams = await getAllRows(`
      SELECT
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.venue LIKE ?
      ORDER BY e.date ASC, e.time ASC
    `, [venuePattern]);

    res.json({
      success: true,
      data: exams,
      count: exams.length,
      venue: venue
    });
  } catch (error) {
    console.error('Error fetching exams by venue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check for conflicts before creating/updating exam
router.post('/check-conflicts', async (req, res) => {
  try {
    const { courseCode, courseName, date, time, venue, duration, excludeId } = req.body;

    if (!date || !time || !venue || !duration) {
      return res.status(400).json({
        error: 'Date, time, venue, and duration are required for conflict check'
      });
    }

    // Validate input data
    const examStart = new Date(`${date}T${time}`);
    if (isNaN(examStart.getTime())) {
      return res.status(400).json({ error: 'Invalid date or time format' });
    }

    const examEnd = new Date(examStart.getTime() + duration * 60000);

    // Find potential conflicts
    let conflictQuery = `
      SELECT
        e.id, e.course_code, e.course_name, e.date, e.time, e.venue, e.duration,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.date = ?
      AND e.status = 'upcoming'
    `;

    const params = [date];

    // Exclude current exam if updating
    if (excludeId) {
      conflictQuery += ' AND e.id != ?';
      params.push(excludeId);
    }

    const potentialConflicts = await getAllRows(conflictQuery, params);

    const conflicts = [];
    let hasTimeConflict = false;
    let hasVenueConflict = false;

    for (const exam of potentialConflicts) {
      const existingStart = new Date(`${exam.date}T${exam.time}`);
      const existingEnd = new Date(existingStart.getTime() + exam.duration * 60000);

      // Check for time overlap
      const timeOverlap = (examStart < existingEnd && examEnd > existingStart);
      // Check for venue conflict
      const venueConflict = (exam.venue === venue);

      if (timeOverlap || venueConflict) {
        let conflictType = 'unknown';
        let severity = 'warning';
        let message = '';

        if (timeOverlap && venueConflict) {
          conflictType = 'both';
          severity = 'error';
          message = `Complete conflict: Same venue and overlapping time with ${exam.course_code}`;
        } else if (venueConflict) {
          conflictType = 'venue_conflict';
          severity = 'warning';
          message = `Venue conflict: ${exam.course_code} is already scheduled in ${exam.venue}`;
        } else if (timeOverlap) {
          conflictType = 'time_overlap';
          severity = 'warning';
          message = `Time overlap: ${exam.course_code} overlaps with your scheduled time`;
        }

        conflicts.push({
          id: exam.id,
          courseCode: exam.course_code,
          courseName: exam.course_name,
          date: exam.date,
          time: exam.time,
          venue: exam.venue,
          duration: exam.duration,
          createdBy: exam.created_by_name,
          conflictType: conflictType,
          severity: severity,
          message: message,
          overlapMinutes: timeOverlap ? Math.min(
            Math.abs(examEnd - existingStart),
            Math.abs(examStart - existingEnd),
            Math.abs(examEnd - existingEnd)
          ) / 60000 : 0
        });

        if (timeOverlap) hasTimeConflict = true;
        if (venueConflict) hasVenueConflict = true;
      }
    }

    // Provide recommendations
    const recommendations = [];
    if (conflicts.length > 0) {
      if (hasVenueConflict) {
        recommendations.push('Consider using a different venue to avoid conflicts');
      }
      if (hasTimeConflict) {
        recommendations.push('Consider rescheduling to a different time slot');
        recommendations.push('Check available time slots in the calendar view');
      }
      recommendations.push('Review existing exams in the timetable before scheduling');
    }

    res.json({
      success: true,
      hasConflicts: conflicts.length > 0,
      conflicts: conflicts,
      count: conflicts.length,
      summary: {
        totalConflicts: conflicts.length,
        timeConflicts: conflicts.filter(c => c.conflictType === 'time_overlap' || c.conflictType === 'both').length,
        venueConflicts: conflicts.filter(c => c.conflictType === 'venue_conflict' || c.conflictType === 'both').length,
        severity: conflicts.some(c => c.severity === 'error') ? 'error' : 'warning'
      },
      recommendations: recommendations,
      checkedExam: {
        courseCode: courseCode || 'Unknown',
        courseName: courseName || 'Unknown',
        date: date,
        time: time,
        venue: venue,
        duration: duration
      }
    });
  } catch (error) {
    console.error('Error checking conflicts:', error);
    res.status(500).json({ error: 'Internal server error during conflict check' });
  }
});

// Get all conflicts in the system
router.get('/conflicts/all', async (req, res) => {
  try {
    // Find all exam pairs that have conflicts
    const allExams = await getAllRows(`
      SELECT e.id, e.course_code, e.course_name, e.date, e.time, e.venue, e.duration
      FROM exams e
      WHERE e.status = 'upcoming'
      ORDER BY e.date, e.time
    `);

    const conflicts = [];

    for (let i = 0; i < allExams.length; i++) {
      for (let j = i + 1; j < allExams.length; j++) {
        const exam1 = allExams[i];
        const exam2 = allExams[j];

        // Only check exams on the same date
        if (exam1.date !== exam2.date) continue;

        const start1 = new Date(`${exam1.date}T${exam1.time}`);
        const end1 = new Date(start1.getTime() + exam1.duration * 60000);
        const start2 = new Date(`${exam2.date}T${exam2.time}`);
        const end2 = new Date(start2.getTime() + exam2.duration * 60000);

        // Check for overlap
        if (start1 < end2 && end1 > start2) {
          conflicts.push({
            exam1: exam1,
            exam2: exam2,
            conflictType: exam1.venue === exam2.venue ? 'both' : 'time_overlap',
            date: exam1.date,
            severity: exam1.venue === exam2.venue ? 'error' : 'warning'
          });
        }
      }
    }

    res.json({
      success: true,
      conflicts: conflicts,
      count: conflicts.length,
      summary: {
        totalConflicts: conflicts.length,
        venueConflicts: conflicts.filter(c => c.conflictType === 'both').length,
        timeConflicts: conflicts.filter(c => c.conflictType === 'time_overlap').length
      }
    });
  } catch (error) {
    console.error('Error getting all conflicts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk operations for exams
router.post('/bulk/status', authenticateToken, requireLecturerOrAdmin, async (req, res) => {
  try {
    const { examIds, status } = req.body;

    if (!examIds || !Array.isArray(examIds) || examIds.length === 0) {
      return res.status(400).json({ error: 'examIds array is required' });
    }

    if (!['upcoming', 'ongoing', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const placeholders = examIds.map(() => '?').join(',');
    await runQuery(`
      UPDATE exams
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `, [status, ...examIds]);

    res.json({
      success: true,
      message: `Updated ${examIds.length} exams to status: ${status}`,
      updatedCount: examIds.length
    });
  } catch (error) {
    console.error('Error in bulk status update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
