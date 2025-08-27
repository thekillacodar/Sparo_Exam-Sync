import express from 'express';
import { getAllRows, runQuery } from '../config/database.js';

const router = express.Router();

// Get all notifications
router.get('/', async (req, res) => {
  try {
    // For now, get all notifications - in a real app, this would be filtered by user
    const notifications = await getAllRows(`
      SELECT n.*, u.first_name || ' ' || u.last_name as user_name
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      data: notifications,
      count: notifications.length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create notification
router.post('/', async (req, res) => {
  try {
    const { userId, title, message, type = 'info' } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        error: 'userId, title, and message are required'
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
      message: 'Notification created successfully',
      notificationId: result.lastID
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    await runQuery(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await runQuery('DELETE FROM notifications WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
