import express from 'express';
import { getAllRows, getRow, runQuery } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

// Get offline data snapshot for caching
router.get('/snapshot', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { includeExams = 'true', includeNotifications = 'true', lastSync } = req.query;

    const snapshot = {
      timestamp: new Date().toISOString(),
      user: req.user,
      data: {}
    };

    // Include exams data
    if (includeExams === 'true') {
      let examsQuery = `
        SELECT
          e.*,
          u.first_name || ' ' || u.last_name as created_by_name,
          CASE
            WHEN e.date = date('now') THEN 'today'
            WHEN e.date = date('now', '+1 day') THEN 'tomorrow'
            WHEN e.date >= date('now') AND e.date <= date('now', '+7 days') THEN
              strftime('%w', e.date) || ' days'
            ELSE strftime('%Y-%m-%d', e.date)
          END as relative_date
        FROM exams e
        LEFT JOIN users u ON e.created_by = u.id
      `;

      const params = [];

      // Only get changes since last sync if provided
      if (lastSync) {
        examsQuery += ' WHERE e.updated_at > ?';
        params.push(lastSync);
      }

      examsQuery += ' ORDER BY e.updated_at DESC';

      snapshot.data.exams = await getAllRows(examsQuery, params);
    }

    // Include notifications data
    if (includeNotifications === 'true') {
      let notificationsQuery = `
        SELECT * FROM notifications
        WHERE user_id = ?
      `;

      const params = [userId];

      // Only get changes since last sync if provided
      if (lastSync) {
        notificationsQuery += ' AND created_at > ?';
        params.push(lastSync);
      }

      notificationsQuery += ' ORDER BY created_at DESC LIMIT 50';

      snapshot.data.notifications = await getAllRows(notificationsQuery, params);
    }

    // Include user preferences/settings
    snapshot.data.userPreferences = {
      theme: 'light',
      notifications: true,
      autoSync: true,
      offlineMode: false
    };

    // Calculate data version/hash for change detection
    const dataString = JSON.stringify(snapshot.data);
    snapshot.version = simpleHash(dataString);

    res.json({
      success: true,
      snapshot
    });

  } catch (error) {
    console.error('Snapshot error:', error);
    res.status(500).json({ error: 'Failed to generate offline snapshot' });
  }
});

// Upload offline changes for synchronization
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { changes, deviceId = 'unknown', lastSync } = req.body;

    if (!changes || !Array.isArray(changes)) {
      return res.status(400).json({ error: 'Changes array is required' });
    }

    const syncResults = {
      successful: [],
      failed: [],
      conflicts: [],
      summary: {
        total: changes.length,
        processed: 0,
        successful: 0,
        failed: 0,
        conflicts: 0
      }
    };

    // Process each change
    for (const change of changes) {
      try {
        const result = await processOfflineChange(change, userId, deviceId);
        syncResults.successful.push(result);
        syncResults.summary.successful++;
      } catch (error) {
        console.error(`Failed to process change ${change.id}:`, error);
        syncResults.failed.push({
          changeId: change.id,
          error: error.message,
          change: change
        });
        syncResults.summary.failed++;
      }
      syncResults.summary.processed++;
    }

    // Create sync notification
    const syncMessage = `Offline sync completed: ${syncResults.summary.successful} successful, ${syncResults.summary.failed} failed`;
    await createNotification(userId, 'offline_sync', null, syncMessage);

    // Return sync results
    res.json({
      success: true,
      message: syncMessage,
      results: syncResults,
      serverTimestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to synchronize offline changes' });
  }
});

// Process individual offline change
async function processOfflineChange(change, userId, deviceId) {
  const { id, type, action, data, timestamp } = change;

  switch (type) {
    case 'exam':
      return await processExamChange(action, data, userId, deviceId);

    case 'notification':
      return await processNotificationChange(action, data, userId);

    default:
      throw new Error(`Unknown change type: ${type}`);
  }
}

// Process exam-related changes
async function processExamChange(action, data, userId, deviceId) {
  switch (action) {
    case 'create':
      // Check for conflicts before creating
      const conflicts = await checkExamConflicts(data);

      if (conflicts.length > 0) {
        // Store as pending change that needs resolution
        await storePendingChange({
          id: `exam_create_${Date.now()}`,
          type: 'exam',
          action: 'create',
          data: { ...data, conflicts },
          userId,
          deviceId,
          created_at: new Date().toISOString()
        });

        return {
          changeId: data.id,
          action: 'pending_resolution',
          message: 'Exam creation pending conflict resolution',
          conflicts: conflicts
        };
      }

      // Create exam
      const result = await runQuery(
        `INSERT INTO exams (course_code, course_name, date, time, venue, duration, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.course_code, data.course_name, data.date, data.time, data.venue, data.duration, data.status || 'upcoming', userId]
      );

      return {
        changeId: data.id,
        action: 'created',
        examId: result.lastID,
        message: 'Exam created successfully'
      };

    case 'update':
      // Check if exam exists and user has permission
      const existingExam = await getRow('SELECT * FROM exams WHERE id = ?', [data.id]);

      if (!existingExam) {
        throw new Error('Exam not found');
      }

      if (existingExam.created_by !== userId && req.user.role !== 'admin') {
        throw new Error('Permission denied: can only edit own exams');
      }

      // Update exam
      await runQuery(
        `UPDATE exams SET
         course_code = ?, course_name = ?, date = ?, time = ?,
         venue = ?, duration = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [data.course_code, data.course_name, data.date, data.time,
         data.venue, data.duration, data.status, data.id]
      );

      return {
        changeId: data.id,
        action: 'updated',
        examId: data.id,
        message: 'Exam updated successfully'
      };

    case 'delete':
      const examToDelete = await getRow('SELECT * FROM exams WHERE id = ?', [data.id]);

      if (!examToDelete) {
        throw new Error('Exam not found');
      }

      if (examToDelete.created_by !== userId && req.user.role !== 'admin') {
        throw new Error('Permission denied: can only delete own exams');
      }

      await runQuery('DELETE FROM exams WHERE id = ?', [data.id]);

      return {
        changeId: data.id,
        action: 'deleted',
        examId: data.id,
        message: 'Exam deleted successfully'
      };

    default:
      throw new Error(`Unknown exam action: ${action}`);
  }
}

// Process notification-related changes
async function processNotificationChange(action, data, userId) {
  switch (action) {
    case 'mark_read':
      await runQuery(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [data.id, userId]
      );

      return {
        changeId: data.id,
        action: 'marked_read',
        message: 'Notification marked as read'
      };

    case 'delete':
      await runQuery(
        'DELETE FROM notifications WHERE id = ? AND user_id = ?',
        [data.id, userId]
      );

      return {
        changeId: data.id,
        action: 'deleted',
        message: 'Notification deleted'
      };

    default:
      throw new Error(`Unknown notification action: ${action}`);
  }
}

// Check for exam conflicts
async function checkExamConflicts(examData) {
  const conflicts = [];

  // Check time overlaps
  const timeConflicts = await getAllRows(`
    SELECT
      e.id, e.course_code, e.course_name, e.date, e.time, e.duration,
      u.first_name || ' ' || u.last_name as created_by_name
    FROM exams e
    LEFT JOIN users u ON e.created_by = u.id
    WHERE e.date = ?
    AND (
      (e.time <= ? AND datetime(e.time, '+' || e.duration || ' minutes') > ?)
      OR
      (? <= e.time AND datetime(?, '+' || ? || ' minutes') > e.time)
    )
    AND e.status = 'upcoming'
  `, [examData.date, examData.time, examData.time, examData.time, examData.time, examData.duration]);

  if (timeConflicts.length > 0) {
    conflicts.push({
      type: 'time_overlap',
      severity: 'high',
      message: `Time conflict with ${timeConflicts.length} exam(s)`,
      conflictingExams: timeConflicts
    });
  }

  // Check venue conflicts
  const venueConflicts = await getAllRows(`
    SELECT
      e.id, e.course_code, e.course_name, e.date, e.time, e.duration,
      u.first_name || ' ' || u.last_name as created_by_name
    FROM exams e
    LEFT JOIN users u ON e.created_by = u.id
    WHERE e.date = ?
    AND e.venue = ?
    AND e.status = 'upcoming'
    AND (
      (e.time <= ? AND datetime(e.time, '+' || e.duration || ' minutes') > ?)
      OR
      (? <= e.time AND datetime(?, '+' || ? || ' minutes') > e.time)
    )
  `, [examData.date, examData.venue, examData.time, examData.time, examData.time, examData.time, examData.duration]);

  if (venueConflicts.length > 0) {
    conflicts.push({
      type: 'venue_conflict',
      severity: 'high',
      message: `Venue conflict with ${venueConflicts.length} exam(s)`,
      conflictingExams: venueConflicts
    });
  }

  return conflicts;
}

// Store pending change for conflict resolution
async function storePendingChange(changeData) {
  await runQuery(`
    INSERT OR REPLACE INTO offline_pending_changes
    (change_id, change_type, change_action, change_data, user_id, device_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    changeData.id,
    changeData.type,
    changeData.action,
    JSON.stringify(changeData.data),
    changeData.userId,
    changeData.deviceId,
    changeData.created_at
  ]);
}

// Get pending changes for resolution
router.get('/pending-changes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const pendingChanges = await getAllRows(`
      SELECT * FROM offline_pending_changes
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [userId]);

    // Parse change data
    const formattedChanges = pendingChanges.map(change => ({
      ...change,
      change_data: JSON.parse(change.change_data)
    }));

    res.json({
      success: true,
      pendingChanges: formattedChanges
    });

  } catch (error) {
    console.error('Get pending changes error:', error);
    res.status(500).json({ error: 'Failed to get pending changes' });
  }
});

// Resolve pending change
router.post('/resolve-change/:changeId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { changeId } = req.params;
    const { resolution } = req.body; // 'accept', 'reject', or 'modify'

    const pendingChange = await getRow(`
      SELECT * FROM offline_pending_changes
      WHERE change_id = ? AND user_id = ?
    `, [changeId, userId]);

    if (!pendingChange) {
      return res.status(404).json({ error: 'Pending change not found' });
    }

    const changeData = JSON.parse(pendingChange.change_data);

    if (resolution === 'accept') {
      // Process the change without conflict checking
      await processOfflineChange({
        id: changeId,
        type: pendingChange.change_type,
        action: pendingChange.change_action,
        data: changeData,
        timestamp: pendingChange.created_at
      }, userId, pendingChange.device_id);
    } else if (resolution === 'modify') {
      // Update the change data and reprocess
      const modifiedData = req.body.modifiedData;
      await processOfflineChange({
        id: changeId,
        type: pendingChange.change_type,
        action: pendingChange.change_action,
        data: modifiedData,
        timestamp: pendingChange.created_at
      }, userId, pendingChange.device_id);
    }

    // Remove from pending changes
    await runQuery(
      'DELETE FROM offline_pending_changes WHERE change_id = ?',
      [changeId]
    );

    res.json({
      success: true,
      message: `Change ${changeId} resolved with ${resolution}`
    });

  } catch (error) {
    console.error('Resolve change error:', error);
    res.status(500).json({ error: 'Failed to resolve pending change' });
  }
});

// Get offline queue status
router.get('/queue-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await getRow(`
      SELECT
        COUNT(*) as total_pending,
        COUNT(CASE WHEN change_type = 'exam' THEN 1 END) as exam_changes,
        COUNT(CASE WHEN change_type = 'notification' THEN 1 END) as notification_changes,
        MIN(created_at) as oldest_change,
        MAX(created_at) as newest_change
      FROM offline_pending_changes
      WHERE user_id = ?
    `, [userId]);

    res.json({
      success: true,
      queueStatus: {
        hasPendingChanges: stats.total_pending > 0,
        totalPending: stats.total_pending || 0,
        examChanges: stats.exam_changes || 0,
        notificationChanges: stats.notification_changes || 0,
        oldestChange: stats.oldest_change,
        newestChange: stats.newest_change
      }
    });

  } catch (error) {
    console.error('Queue status error:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// Simple hash function for change detection
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

export default router;
