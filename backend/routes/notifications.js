import express from 'express';
import { getAllRows, getRow, runQuery } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user notifications (requires authentication)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const userId = req.user.id;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE n.user_id = ?';
    const params = [userId];

    if (status === 'unread') {
      whereClause += ' AND n.is_read = 0';
    } else if (status === 'read') {
      whereClause += ' AND n.is_read = 1';
    }

    const notifications = await getAllRows(`
      SELECT
        n.*,
        DATETIME(n.created_at, 'localtime') as created_at_local,
        CASE
          WHEN n.created_at >= datetime('now', '-1 hour') THEN 'Just now'
          WHEN n.created_at >= datetime('now', '-24 hours') THEN strftime('%H hours ago', 'now', '-' || n.created_at)
          WHEN n.created_at >= datetime('now', '-7 days') THEN strftime('%w days ago', 'now', '-' || n.created_at)
          ELSE strftime('%Y-%m-%d %H:%M', n.created_at)
        END as time_ago
      FROM notifications n
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // Get total count for pagination
    const totalCount = await getRow(`
      SELECT COUNT(*) as count FROM notifications n ${whereClause}
    `, params);

    // Get unread count for badge
    const unreadCount = await getRow(`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
    `, [userId]);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / parseInt(limit))
      },
      unreadCount: unreadCount.count,
      count: notifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notification statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await getRow(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN type = 'reminder' THEN 1 ELSE 0 END) as reminders,
        SUM(CASE WHEN type = 'warning' THEN 1 ELSE 0 END) as warnings,
        SUM(CASE WHEN type = 'success' THEN 1 ELSE 0 END) as successes,
        SUM(CASE WHEN type = 'info' THEN 1 ELSE 0 END) as infos
      FROM notifications
      WHERE user_id = ?
    `, [userId]);

    res.json({
      success: true,
      data: {
        total: stats.total || 0,
        unread: stats.unread || 0,
        read: (stats.total || 0) - (stats.unread || 0),
        byType: {
          reminder: stats.reminders || 0,
          warning: stats.warnings || 0,
          success: stats.successes || 0,
          info: stats.infos || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread count for badge (lightweight endpoint)
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await getRow(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `, [userId]);

    res.json({
      success: true,
      count: result.count || 0
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create notification (requires authentication)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { userId, title, message, type = 'info' } = req.body;

    // If no userId specified, use the authenticated user's ID
    const targetUserId = userId || req.user.id;

    if (!title || !message) {
      return res.status(400).json({
        error: 'title and message are required'
      });
    }

    if (!['reminder', 'warning', 'success', 'info'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid notification type. Must be: reminder, warning, success, or info'
      });
    }

    const result = await runQuery(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `, [targetUserId, title, message, type]);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      notificationId: result.lastID
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create notification for specific user (admin only)
router.post('/admin/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        message: 'Only administrators can send notifications to other users'
      });
    }

    const { userId } = req.params;
    const { title, message, type = 'info' } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        error: 'title and message are required'
      });
    }

    if (!['reminder', 'warning', 'success', 'info'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid notification type. Must be: reminder, warning, success, or info'
      });
    }

    const result = await runQuery(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `, [userId, title, message, type]);

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      notificationId: result.lastID
    });
  } catch (error) {
    console.error('Error creating admin notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk mark as read
router.put('/bulk/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await runQuery(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = ? AND is_read = 0
    `, [userId]);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk delete notifications
router.delete('/bulk', authenticateToken, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user.id;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds array is required' });
    }

    const placeholders = notificationIds.map(() => '?').join(',');
    await runQuery(`
      DELETE FROM notifications
      WHERE user_id = ? AND id IN (${placeholders})
    `, [userId, ...notificationIds]);

    res.json({
      success: true,
      message: `${notificationIds.length} notifications deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear all notifications for user
router.delete('/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query; // Optional: delete only specific type

    let query = 'DELETE FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (type && ['reminder', 'warning', 'success', 'info'].includes(type)) {
      query += ' AND type = ?';
      params.push(type);
    }

    await runQuery(query, params);

    res.json({
      success: true,
      message: type ? `All ${type} notifications cleared` : 'All notifications cleared'
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read (requires authentication)
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if notification belongs to user
    const notification = await getRow(`
      SELECT id FROM notifications WHERE id = ? AND user_id = ?
    `, [id, userId]);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await runQuery(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ?
    `, [id, userId]);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete notification (requires authentication)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if notification belongs to user
    const notification = await getRow(`
      SELECT id FROM notifications WHERE id = ? AND user_id = ?
    `, [id, userId]);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await runQuery('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Automatic notification creation utility
export const createNotification = async (userId, title, message, type = 'info') => {
  try {
    const result = await runQuery(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `, [userId, title, message, type]);

    return result.lastID;
  } catch (error) {
    console.error('Error creating automatic notification:', error);
    throw error;
  }
};

// Create notification for exam events
export const createExamNotification = async (examData, eventType, targetUsers = null) => {
  try {
    let title, message, type;

    switch (eventType) {
      case 'created':
        title = 'Exam Scheduled';
        message = `New exam scheduled: ${examData.courseName} (${examData.courseCode}) on ${examData.date} at ${examData.time}`;
        type = 'success';
        break;
      case 'updated':
        title = 'Exam Updated';
        message = `Exam updated: ${examData.courseName} (${examData.courseCode}) - Check timetable for changes`;
        type = 'warning';
        break;
      case 'deleted':
        title = 'Exam Cancelled';
        message = `Exam cancelled: ${examData.courseName} (${examData.courseCode})`;
        type = 'warning';
        break;
      case 'conflict':
        title = 'Schedule Conflict Detected';
        message = `Potential conflict with: ${examData.courseName} (${examData.courseCode})`;
        type = 'warning';
        break;
      case 'reminder':
        title = 'Exam Reminder';
        message = `Upcoming exam: ${examData.courseName} (${examData.courseCode}) tomorrow at ${examData.time}`;
        type = 'reminder';
        break;
      default:
        return;
    }

    // If specific users provided, notify them; otherwise notify all users
    if (targetUsers && Array.isArray(targetUsers)) {
      for (const userId of targetUsers) {
        await createNotification(userId, title, message, type);
      }
    } else {
      // Get all users and notify them
      const allUsers = await getAllRows('SELECT id FROM users WHERE is_active = 1');
      for (const user of allUsers) {
        await createNotification(user.id, title, message, type);
      }
    }
  } catch (error) {
    console.error('Error creating exam notification:', error);
    throw error;
  }
};

export default router;
