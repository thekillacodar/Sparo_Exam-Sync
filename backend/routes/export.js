import express from 'express';
import { getAllRows, getRow } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { createExamNotification } from './notifications.js';

const router = express.Router();

// Export timetable as PDF
router.get('/pdf', authenticateToken, async (req, res) => {
  try {
    const { format = 'detailed', dateRange = 'all' } = req.query;
    const userId = req.user.id;

    // Get exam data based on date range
    let exams;
    if (dateRange === 'upcoming') {
      exams = await getAllRows(`
        SELECT
          e.*,
          u.first_name || ' ' || u.last_name as created_by_name,
          CASE
            WHEN e.date = date('now') THEN 'Today'
            WHEN e.date = date('now', '+1 day') THEN 'Tomorrow'
            WHEN e.date >= date('now') AND e.date <= date('now', '+7 days') THEN
              strftime('%w', e.date) || ' days'
            ELSE strftime('%Y-%m-%d', e.date)
          END as relative_date
        FROM exams e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.status = 'upcoming'
        ORDER BY e.date ASC, e.time ASC
      `);
    } else {
      exams = await getAllRows(`
        SELECT
          e.*,
          u.first_name || ' ' || u.last_name as created_by_name,
          strftime('%Y-%m-%d', e.date) as formatted_date
        FROM exams e
        LEFT JOIN users u ON e.created_by = u.id
        ORDER BY e.date ASC, e.time ASC
      `);
    }

    // Generate PDF content
    const pdfContent = generatePDFContent(exams, format, req.user, dateRange);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=examsync-timetable-${new Date().toISOString().split('T')[0]}.pdf`);

    // For now, return HTML that can be converted to PDF
    // In a production app, you'd use a proper PDF library
    res.send(pdfContent);

    // Create notification
    await createExamNotification(null, 'export', [userId]);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF export' });
  }
});

// Export timetable as CSV
router.get('/csv', authenticateToken, async (req, res) => {
  try {
    const { includeCreator = 'true', dateRange = 'all' } = req.query;

    // Get exam data
    let query = `
      SELECT
        e.course_code,
        e.course_name,
        e.date,
        e.time,
        e.venue,
        e.duration,
        e.status
    `;

    if (includeCreator === 'true') {
      query += `, u.first_name || ' ' || u.last_name as created_by`;
    }

    query += `
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
    `;

    if (dateRange === 'upcoming') {
      query += ` WHERE e.status = 'upcoming'`;
    }

    query += ` ORDER BY e.date ASC, e.time ASC`;

    const exams = await getAllRows(query);

    // Generate CSV content
    const csvContent = generateCSVContent(exams, includeCreator === 'true');

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=examsync-timetable-${new Date().toISOString().split('T')[0]}.csv`);

    res.send(csvContent);

  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({ error: 'Failed to generate CSV export' });
  }
});

// Export exam statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    // Get various statistics
    const stats = await getExportStats();

    if (format === 'csv') {
      const csvStats = generateStatsCSV(stats);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=examsync-stats-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvStats);
    } else {
      res.json({
        success: true,
        data: stats,
        generatedAt: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error generating stats export:', error);
    res.status(500).json({ error: 'Failed to generate statistics export' });
  }
});

// Generate PDF content (HTML format that can be converted to PDF)
function generatePDFContent(exams, format, user, dateRange) {
  const title = dateRange === 'upcoming' ? 'Upcoming Exams' : 'Complete Timetable';
  const generatedDate = new Date().toLocaleDateString();

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>ExamSync - ${title}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3B82F6; padding-bottom: 20px; }
            .exam-card { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
            .exam-header { background-color: #f5f5f5; padding: 10px; margin: -15px -15px 15px -15px; border-radius: 5px 5px 0 0; }
            .exam-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
            .detail-item { display: flex; justify-content: space-between; }
            .status-upcoming { color: #10B981; font-weight: bold; }
            .status-completed { color: #6B7280; font-weight: bold; }
            .status-cancelled { color: #EF4444; font-weight: bold; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
            @media print { body { margin: 0; } }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>ExamSync</h1>
            <h2>${title}</h2>
            <p>Generated for: ${user.firstName} ${user.lastName} (${user.role})</p>
            <p>Generated on: ${generatedDate}</p>
        </div>

        <div class="content">
  `;

  if (exams.length === 0) {
    html += '<p>No exams found for the selected criteria.</p>';
  } else {
    exams.forEach((exam, index) => {
      const statusClass = `status-${exam.status}`;
      const relativeDate = exam.relative_date || exam.formatted_date;

      html += `
        <div class="exam-card">
            <div class="exam-header">
                <h3>${exam.course_code} - ${exam.course_name}</h3>
                <span class="${statusClass}">${exam.status.toUpperCase()}</span>
            </div>

            <div class="exam-details">
                <div class="detail-item">
                    <strong>Date:</strong>
                    <span>${new Date(exam.date).toLocaleDateString()}</span>
                </div>
                <div class="detail-item">
                    <strong>Time:</strong>
                    <span>${exam.time} (${exam.duration} minutes)</span>
                </div>
                <div class="detail-item">
                    <strong>Venue:</strong>
                    <span>${exam.venue}</span>
                </div>
                <div class="detail-item">
                    <strong>Created by:</strong>
                    <span>${exam.created_by_name}</span>
                </div>
      `;

      if (format === 'detailed' && exam.relative_date) {
        html += `
                <div class="detail-item">
                    <strong>Relative:</strong>
                    <span>${exam.relative_date}</span>
                </div>
        `;
      }

      html += `
            </div>
        </div>
      `;
    });
  }

  html += `
        </div>

        <div class="footer">
            <p>Total Exams: ${exams.length}</p>
            <p>Generated by ExamSync - Smart Examination Management</p>
        </div>
    </body>
    </html>
  `;

  return html;
}

// Generate CSV content
function generateCSVContent(exams, includeCreator) {
  let csv = 'Course Code,Course Name,Date,Time,Venue,Duration,Status';

  if (includeCreator) {
    csv += ',Created By';
  }

  csv += '\n';

  exams.forEach(exam => {
    const row = [
      `"${exam.course_code}"`,
      `"${exam.course_name}"`,
      exam.date,
      exam.time,
      `"${exam.venue}"`,
      exam.duration,
      exam.status
    ];

    if (includeCreator) {
      row.push(`"${exam.created_by}"`);
    }

    csv += row.join(',') + '\n';
  });

  return csv;
}

// Get export statistics
async function getExportStats() {
  try {
    const totalExams = await getRow('SELECT COUNT(*) as count FROM exams');
    const upcomingExams = await getRow('SELECT COUNT(*) as count FROM exams WHERE status = "upcoming"');
    const completedExams = await getRow('SELECT COUNT(*) as count FROM exams WHERE status = "completed"');
    const cancelledExams = await getRow('SELECT COUNT(*) as count FROM exams WHERE status = "cancelled"');

    // Exams by month
    const examsByMonth = await getAllRows(`
      SELECT
        strftime('%Y-%m', date) as month,
        COUNT(*) as count
      FROM exams
      GROUP BY strftime('%Y-%m', date)
      ORDER BY month DESC
      LIMIT 12
    `);

    // Most popular venues
    const popularVenues = await getAllRows(`
      SELECT venue, COUNT(*) as count
      FROM exams
      GROUP BY venue
      ORDER BY count DESC
      LIMIT 10
    `);

    // Most active creators
    const activeCreators = await getAllRows(`
      SELECT
        u.first_name || ' ' || u.last_name as creator_name,
        COUNT(*) as exams_created
      FROM exams e
      JOIN users u ON e.created_by = u.id
      GROUP BY e.created_by
      ORDER BY exams_created DESC
      LIMIT 10
    `);

    return {
      summary: {
        totalExams: totalExams.count || 0,
        upcomingExams: upcomingExams.count || 0,
        completedExams: completedExams.count || 0,
        cancelledExams: cancelledExams.count || 0
      },
      examsByMonth: examsByMonth,
      popularVenues: popularVenues,
      activeCreators: activeCreators
    };
  } catch (error) {
    console.error('Error getting export stats:', error);
    return {};
  }
}

// Generate CSV for statistics
function generateStatsCSV(stats) {
  let csv = 'Category,Metric,Value\n';

  // Summary stats
  csv += `Summary,Total Exams,${stats.summary?.totalExams || 0}\n`;
  csv += `Summary,Upcoming Exams,${stats.summary?.upcomingExams || 0}\n`;
  csv += `Summary,Completed Exams,${stats.summary?.completedExams || 0}\n`;
  csv += `Summary,Cancelled Exams,${stats.summary?.cancelledExams || 0}\n`;

  // Exams by month
  if (stats.examsByMonth) {
    stats.examsByMonth.forEach(item => {
      csv += `Monthly,${item.month},${item.count}\n`;
    });
  }

  // Popular venues
  if (stats.popularVenues) {
    stats.popularVenues.forEach(item => {
      csv += `Venues,"${item.venue}",${item.count}\n`;
    });
  }

  // Active creators
  if (stats.activeCreators) {
    stats.activeCreators.forEach(item => {
      csv += `Creators,"${item.creator_name}",${item.exams_created}\n`;
    });
  }

  return csv;
}

export default router;
