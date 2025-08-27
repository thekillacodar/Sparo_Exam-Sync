import express from 'express';
import { getAllRows, getRow } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get comprehensive dashboard data
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get dashboard statistics
    const stats = await getDashboardStats(userRole);

    // Get upcoming exams (next 3)
    const upcomingExams = await getUpcomingExams(3);

    // Get recent notifications (last 5)
    const recentNotifications = await getRecentNotifications(userId, 5);

    // Get quick actions based on user role
    const quickActions = getQuickActions(userRole);

    // Get system health/overview
    const systemOverview = await getSystemOverview();

    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          name: req.user.firstName + ' ' + req.user.lastName,
          email: req.user.email,
          role: req.user.role
        },
        stats: stats,
        upcomingExams: upcomingExams,
        recentNotifications: recentNotifications,
        quickActions: quickActions,
        systemOverview: systemOverview,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      error: 'Failed to load dashboard',
      message: 'Unable to retrieve dashboard data. Please try again later.'
    });
  }
});

// Get dashboard statistics
async function getDashboardStats(userRole) {
  try {
    // Total upcoming exams
    const totalUpcoming = await getRow(`
      SELECT COUNT(*) as count
      FROM exams
      WHERE date >= date('now') AND status = 'upcoming'
    `);

    // Exams this week
    const thisWeek = await getRow(`
      SELECT COUNT(*) as count
      FROM exams
      WHERE date >= date('now')
      AND date <= date('now', '+6 days')
      AND status = 'upcoming'
    `);

    // Today's exams
    const today = await getRow(`
      SELECT COUNT(*) as count
      FROM exams
      WHERE date = date('now') AND status = 'upcoming'
    `);

    // Total notifications (unread)
    const unreadNotifications = await getRow(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE is_read = 0
    `);

    // Role-specific stats
    let roleSpecificStats = {};
    if (userRole === 'admin' || userRole === 'lecturer') {
      // Created exams count
      const createdExams = await getRow(`
        SELECT COUNT(*) as count
        FROM exams
        WHERE created_by = (SELECT id FROM users WHERE email = ?)
      `, [userRole === 'admin' ? 'admin@exam.com' : 'lecturer@exam.com']);

      // Conflict count
      const conflicts = await getRow(`
        SELECT COUNT(*) as count
        FROM exam_conflicts
        WHERE resolved = 0
      `);

      roleSpecificStats = {
        createdExams: createdExams.count || 0,
        unresolvedConflicts: conflicts.count || 0
      };
    }

    return {
      upcomingExams: totalUpcoming.count || 0,
      thisWeekExams: thisWeek.count || 0,
      todayExams: today.count || 0,
      unreadNotifications: unreadNotifications.count || 0,
      ...roleSpecificStats
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      upcomingExams: 0,
      thisWeekExams: 0,
      todayExams: 0,
      unreadNotifications: 0
    };
  }
}

// Get upcoming exams for dashboard
async function getUpcomingExams(limit = 3) {
  try {
    const exams = await getAllRows(`
      SELECT
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        CASE
          WHEN e.date = date('now') THEN 'Today'
          WHEN e.date = date('now', '+1 day') THEN 'Tomorrow'
          WHEN e.date >= date('now') AND e.date <= date('now', '+7 days') THEN
            strftime('%w', e.date) || ' days'
          ELSE strftime('%Y-%m-%d', e.date)
        END as relative_date,
        CASE
          WHEN e.date = date('now') THEN 1
          WHEN e.date = date('now', '+1 day') THEN 2
          ELSE 3
        END as priority
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.date >= date('now') AND e.status = 'upcoming'
      ORDER BY
        CASE
          WHEN e.date = date('now') THEN 1
          WHEN e.date = date('now', '+1 day') THEN 2
          ELSE 3
        END,
        e.date ASC,
        e.time ASC
      LIMIT ?
    `, [limit]);

    return exams.map(exam => ({
      id: exam.id,
      courseCode: exam.course_code,
      courseName: exam.course_name,
      date: exam.date,
      time: exam.time,
      venue: exam.venue,
      duration: exam.duration,
      status: exam.status,
      createdBy: exam.created_by_name,
      relativeDate: exam.relative_date,
      priority: exam.priority,
      timeUntil: getTimeUntil(new Date(exam.date + 'T' + exam.time))
    }));
  } catch (error) {
    console.error('Error fetching upcoming exams:', error);
    return [];
  }
}

// Get recent notifications for dashboard
async function getRecentNotifications(userId, limit = 5) {
  try {
    const notifications = await getAllRows(`
      SELECT
        n.*,
        CASE
          WHEN n.created_at >= datetime('now', '-1 hour') THEN 'Just now'
          WHEN n.created_at >= datetime('now', '-24 hours') THEN strftime('%H hours ago', 'now', '-' || n.created_at)
          WHEN n.created_at >= datetime('now', '-7 days') THEN strftime('%w days ago', 'now', '-' || n.created_at)
          ELSE strftime('%Y-%m-%d %H:%M', n.created_at)
        END as time_ago
      FROM notifications n
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ?
    `, [userId, limit]);

    return notifications;
  } catch (error) {
    console.error('Error fetching recent notifications:', error);
    return [];
  }
}

// Get quick actions based on user role
function getQuickActions(userRole) {
  const commonActions = [
    {
      id: 'view_timetable',
      title: 'View Timetable',
      description: 'Check your exam schedule',
      icon: '📅',
      action: 'navigate',
      path: '/timetable',
      color: 'blue'
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'View recent notifications',
      icon: '🔔',
      action: 'modal',
      modal: 'notifications',
      color: 'yellow'
    }
  ];

  const lecturerAdminActions = [
    {
      id: 'add_exam',
      title: 'Add Exam',
      description: 'Schedule a new examination',
      icon: '➕',
      action: 'modal',
      modal: 'addExam',
      color: 'green',
      primary: true
    },
    {
      id: 'check_conflicts',
      title: 'Check Conflicts',
      description: 'Review scheduling conflicts',
      icon: '⚠️',
      action: 'modal',
      modal: 'conflicts',
      color: 'red'
    },
    {
      id: 'export_data',
      title: 'Export Data',
      description: 'Download timetable as PDF/CSV',
      icon: '📄',
      action: 'modal',
      modal: 'export',
      color: 'purple'
    }
  ];

  const studentActions = [
    {
      id: 'my_exams',
      title: 'My Exams',
      description: 'View your scheduled exams',
      icon: '📚',
      action: 'navigate',
      path: '/my-exams',
      color: 'green'
    },
    {
      id: 'calendar_sync',
      title: 'Sync Calendar',
      description: 'Add exams to your calendar',
      icon: '📅',
      action: 'modal',
      modal: 'calendarSync',
      color: 'blue'
    }
  ];

  if (userRole === 'admin' || userRole === 'lecturer') {
    return [...lecturerAdminActions, ...commonActions];
  } else {
    return [...studentActions, ...commonActions];
  }
}

// Get system overview
async function getSystemOverview() {
  try {
    const totalUsers = await getRow('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    const totalExams = await getRow('SELECT COUNT(*) as count FROM exams WHERE status = "upcoming"');
    const totalConflicts = await getRow('SELECT COUNT(*) as count FROM exam_conflicts WHERE resolved = 0');

    return {
      totalUsers: totalUsers.count || 0,
      totalExams: totalExams.count || 0,
      unresolvedConflicts: totalConflicts.count || 0,
      systemStatus: 'operational'
    };
  } catch (error) {
    console.error('Error fetching system overview:', error);
    return {
      totalUsers: 0,
      totalExams: 0,
      unresolvedConflicts: 0,
      systemStatus: 'unknown'
    };
  }
}

// Utility function for time until exam
function getTimeUntil(examDate) {
  const now = new Date();
  const diff = examDate - now;

  if (diff < 0) return 'Past';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return 'Soon';
}

export default router;
