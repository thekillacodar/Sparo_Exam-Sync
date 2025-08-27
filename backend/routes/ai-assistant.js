import express from 'express';
import { getAllRows, getRow } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from './notifications.js';

const router = express.Router();

// AI Assistant conversation endpoint
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, context = {} } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required and must be a non-empty string'
      });
    }

    // Analyze the message and generate response
    const analysis = await analyzeMessage(message.trim(), userId, userRole);
    const response = await generateResponse(analysis, userId, userRole);

    // Store conversation context for follow-up questions
    const conversationContext = {
      lastQuery: message,
      lastAnalysis: analysis,
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      response: response.text,
      suggestions: response.suggestions,
      actions: response.actions,
      context: conversationContext
    });

  } catch (error) {
    console.error('AI Assistant error:', error);
    res.status(500).json({
      error: 'AI Assistant is temporarily unavailable',
      response: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment."
    });
  }
});

// Analyze user message and extract intent
async function analyzeMessage(message, userId, userRole) {
  const lowerMessage = message.toLowerCase();

  // Define patterns and their corresponding intents
  const patterns = {
    // Schedule/Time related queries
    schedule: [
      /when (is|are) my (next|upcoming) exam/i,
      /what (is|are) my exam schedule/i,
      /show me my (exam )?schedule/i,
      /when do I have exams/i,
      /list my (upcoming )?exams/i
    ],

    weekly: [
      /exam this week/i,
      /weekly schedule/i,
      /week ahead/i,
      /(next|this) week/i
    ],

    today: [
      /exam today/i,
      /today schedule/i,
      /today exams/i
    ],

    tomorrow: [
      /exam tomorrow/i,
      /tomorrow schedule/i,
      /tomorrow exams/i
    ],

    // Conflict related queries
    conflict: [
      /conflict/i,
      /overlap/i,
      /clash/i,
      /problem/i,
      /issue/i
    ],

    // Course specific queries
    course: [
      /course code/i,
      /subject/i,
      /class/i,
      /(cs|math|phy|eng|chem)\d+/i
    ],

    // Venue related queries
    venue: [
      /where (is|are)/i,
      /venue/i,
      /location/i,
      /room/i,
      /building/i
    ],

    // Reminder/Notification queries
    reminder: [
      /remind/i,
      /notify/i,
      /alert/i,
      /reminder/i
    ],

    // Export/Help queries
    export: [
      /export/i,
      /download/i,
      /pdf/i,
      /csv/i,
      /print/i
    ],

    help: [
      /help/i,
      /what can you/i,
      /how (do|can)/i,
      /command/i,
      /assist/i
    ],

    // Statistics/Summary queries
    stats: [
      /how many/i,
      /summary/i,
      /statistics/i,
      /count/i,
      /total/i
    ]
  };

  // Extract intent
  const intent = {};
  for (const [key, patternArray] of Object.entries(patterns)) {
    for (const pattern of patternArray) {
      if (pattern.test(lowerMessage)) {
        intent[key] = true;
        break;
      }
    }
  }

  // Extract entities (specific information from message)
  const entities = extractEntities(lowerMessage);

  // Get relevant data based on intent
  const relevantData = await getRelevantData(intent, entities, userId);

  return {
    intent,
    entities,
    message: lowerMessage,
    data: relevantData
  };
}

// Extract specific entities from message
function extractEntities(message) {
  const entities = {};

  // Extract course codes (e.g., CS101, MATH201)
  const courseCodeMatch = message.match(/(cs|math|phy|eng|chem|bio|hist|geo)\d+/i);
  if (courseCodeMatch) {
    entities.courseCode = courseCodeMatch[0].toUpperCase();
  }

  // Extract dates (today, tomorrow, specific dates)
  if (message.includes('today')) {
    entities.date = 'today';
  } else if (message.includes('tomorrow')) {
    entities.date = 'tomorrow';
  } else if (message.includes('this week') || message.includes('next week')) {
    entities.dateRange = 'week';
  }

  // Extract numbers (for filtering results)
  const numberMatch = message.match(/\d+/);
  if (numberMatch) {
    entities.number = parseInt(numberMatch[0]);
  }

  return entities;
}

// Get relevant data based on intent
async function getRelevantData(intent, entities, userId) {
  const data = {};

  // Get upcoming exams
  if (intent.schedule || intent.weekly || intent.today || intent.tomorrow) {
    let query = `
      SELECT
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.status = 'upcoming'
    `;

    const params = [];

    // Filter by date
    if (entities.date === 'today') {
      query += ' AND e.date = date("now")';
    } else if (entities.date === 'tomorrow') {
      query += ' AND e.date = date("now", "+1 day")';
    } else if (entities.dateRange === 'week') {
      query += ' AND e.date >= date("now") AND e.date <= date("now", "+6 days")';
    } else {
      // Default to upcoming exams
      query += ' AND e.date >= date("now")';
    }

    // Filter by course if specified
    if (entities.courseCode) {
      query += ' AND e.course_code = ?';
      params.push(entities.courseCode);
    }

    query += ' ORDER BY e.date ASC, e.time ASC';

    if (entities.number) {
      query += ' LIMIT ?';
      params.push(entities.number);
    } else {
      query += ' LIMIT 5'; // Default limit
    }

    data.exams = await getAllRows(query, params);
  }

  // Get conflict information
  if (intent.conflict) {
    const conflicts = await getAllRows(`
      SELECT
        e1.course_code as exam1_code, e1.course_name as exam1_name,
        e2.course_code as exam2_code, e2.course_name as exam2_name,
        ec.conflict_type, ec.date, ec.severity
      FROM exam_conflicts ec
      JOIN exams e1 ON ec.exam1_id = e1.id
      JOIN exams e2 ON ec.exam2_id = e2.id
      WHERE ec.resolved = 0
      ORDER BY ec.created_at DESC
      LIMIT 5
    `);

    data.conflicts = conflicts;
  }

  // Get statistics
  if (intent.stats) {
    const stats = await getRow(`
      SELECT
        COUNT(CASE WHEN date >= date('now') AND status = 'upcoming' THEN 1 END) as upcoming,
        COUNT(CASE WHEN date = date('now') THEN 1 END) as today,
        COUNT(CASE WHEN date >= date('now') AND date <= date('now', '+6 days') AND status = 'upcoming' THEN 1 END) as this_week
      FROM exams
    `);

    data.stats = stats;
  }

  return data;
}

// Generate intelligent response based on analysis
async function generateResponse(analysis, userId, userRole) {
  const { intent, entities, data } = analysis;

  let response = {
    text: '',
    suggestions: [],
    actions: []
  };

  // Handle different intents
  if (intent.help) {
    response.text = generateHelpResponse(userRole);
    response.suggestions = [
      'Show my exam schedule',
      'Check for conflicts',
      'Export my timetable',
      'Set exam reminders'
    ];
  }
  else if (intent.schedule || intent.weekly || intent.today || intent.tomorrow) {
    response = generateScheduleResponse(analysis, userRole);
  }
  else if (intent.conflict) {
    response = generateConflictResponse(data);
  }
  else if (intent.reminder) {
    response = generateReminderResponse(data);
  }
  else if (intent.export) {
    response = generateExportResponse();
  }
  else if (intent.stats) {
    response = generateStatsResponse(data);
  }
  else if (intent.course) {
    response = generateCourseResponse(analysis);
  }
  else if (intent.venue) {
    response = generateVenueResponse(analysis);
  }
  else {
    // General conversation or unknown intent
    response.text = generateGeneralResponse(analysis);
    response.suggestions = [
      'What exams do I have this week?',
      'Are there any scheduling conflicts?',
      'Show my upcoming exams',
      'Help me understand the system'
    ];
  }

  return response;
}

// Generate schedule-specific responses
function generateScheduleResponse(analysis, userRole) {
  const { entities, data } = analysis;
  let response = { text: '', suggestions: [], actions: [] };

  const exams = data.exams || [];

  if (exams.length === 0) {
    if (entities.date === 'today') {
      response.text = "You don't have any exams scheduled for today. Enjoy your day! 📚";
    } else if (entities.date === 'tomorrow') {
      response.text = "You don't have any exams scheduled for tomorrow. Great time to prepare! 🎯";
    } else {
      response.text = "You don't have any upcoming exams scheduled. Would you like me to help you add some exams or check for future schedules?";
    }

    response.suggestions = [
      'Add a new exam',
      'Check all upcoming exams',
      'View calendar'
    ];
  } else {
    let timeFrame = 'upcoming';
    if (entities.date === 'today') timeFrame = 'today';
    else if (entities.date === 'tomorrow') timeFrame = 'tomorrow';
    else if (entities.dateRange === 'week') timeFrame = 'this week';

    response.text = `Here are your exams for ${timeFrame}:\n\n`;

    exams.forEach((exam, index) => {
      const examDate = new Date(exam.date).toLocaleDateString();
      response.text += `${index + 1}. **${exam.course_code} - ${exam.course_name}**\n`;
      response.text += `   📅 ${examDate} at ${exam.time}\n`;
      response.text += `   📍 ${exam.venue}\n`;
      response.text += `   ⏱️ ${exam.duration} minutes\n\n`;
    });

    response.actions = [
      {
        type: 'view_calendar',
        label: 'View in Calendar',
        data: { date: exams[0]?.date }
      }
    ];
  }

  return response;
}

// Generate conflict-specific responses
function generateConflictResponse(data) {
  const conflicts = data.conflicts || [];
  let response = { text: '', suggestions: [], actions: [] };

  if (conflicts.length === 0) {
    response.text = "🎉 Great news! I don't see any scheduling conflicts in your timetable. All your exams are properly scheduled without overlaps.";
    response.suggestions = [
      'View full timetable',
      'Add new exam',
      'Check venue availability'
    ];
  } else {
    response.text = `⚠️ I found ${conflicts.length} scheduling conflict(s) that need attention:\n\n`;

    conflicts.forEach((conflict, index) => {
      response.text += `${index + 1}. **${conflict.exam1_code}** and **${conflict.exam2_code}** on ${conflict.date}\n`;
      response.text += `   Type: ${conflict.conflict_type.replace('_', ' ').toUpperCase()}\n`;
      response.text += `   Severity: ${conflict.severity.toUpperCase()}\n\n`;
    });

    response.text += "Would you like me to help you resolve these conflicts?";

    response.actions = [
      {
        type: 'view_conflicts',
        label: 'View Conflict Details',
        data: {}
      },
      {
        type: 'resolve_conflicts',
        label: 'Resolve Conflicts',
        data: {}
      }
    ];
  }

  return response;
}

// Generate help response
function generateHelpResponse(userRole) {
  let helpText = `👋 Hi! I'm your ExamSync AI Assistant. I can help you with:\n\n`;

  helpText += `📅 **Schedule Management**\n`;
  helpText += `• "When is my next exam?"\n`;
  helpText += `• "Show me this week's exams"\n`;
  helpText += `• "What exams do I have today?"\n\n`;

  helpText += `⚠️ **Conflict Detection**\n`;
  helpText += `• "Check for conflicts"\n`;
  helpText += `• "Are there any overlaps?"\n\n`;

  helpText += `📊 **Information & Stats**\n`;
  helpText += `• "How many exams do I have?"\n`;
  helpText += `• "Show me statistics"\n\n`;

  if (userRole === 'admin' || userRole === 'lecturer') {
    helpText += `👨‍🏫 **Management Tools** (${userRole})\n`;
    helpText += `• "Create a new exam"\n`;
    helpText += `• "Export timetable"\n`;
    helpText += `• "Manage notifications"\n\n`;
  }

  helpText += `💡 **Tips:** Be specific about dates, courses, or what you need help with!`;

  return helpText;
}

// Generate general response for unknown queries
function generateGeneralResponse(analysis) {
  const responses = [
    "I'm here to help you manage your exam schedule! Try asking me about your upcoming exams, conflicts, or schedule information.",
    "I can assist you with exam scheduling, conflict detection, and timetable management. What would you like to know?",
    "Feel free to ask me about your exams, schedule, conflicts, or any timetable-related questions!",
    "I'm your exam scheduling assistant. I can help you check schedules, detect conflicts, set reminders, and manage your timetable."
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate export response
function generateExportResponse() {
  return {
    text: "I can help you export your timetable in different formats:\n\n📄 **PDF Export**: Formatted timetable with your exam details\n📊 **CSV Export**: Spreadsheet format for data analysis\n📈 **Statistics**: Summary of your exam data\n\nWould you like me to generate an export for you?",
    suggestions: [
      'Export as PDF',
      'Export as CSV',
      'View statistics'
    ],
    actions: [
      {
        type: 'export_pdf',
        label: 'Export PDF',
        data: { format: 'pdf' }
      },
      {
        type: 'export_csv',
        label: 'Export CSV',
        data: { format: 'csv' }
      }
    ]
  };
}

// Generate stats response
function generateStatsResponse(data) {
  const stats = data.stats;
  let response = "📊 Here's your exam statistics:\n\n";

  if (stats) {
    response += `📅 **Upcoming Exams**: ${stats.upcoming || 0}\n`;
    response += `🎯 **Exams Today**: ${stats.today || 0}\n`;
    response += `📆 **This Week**: ${stats.this_week || 0}\n`;
  }

  response += "\nWould you like a detailed breakdown or export these statistics?";

  return {
    text: response,
    suggestions: [
      'View detailed stats',
      'Export statistics',
      'Show calendar view'
    ],
    actions: [
      {
        type: 'view_detailed_stats',
        label: 'View Details',
        data: {}
      }
    ]
  };
}

// Generate course-specific response
function generateCourseResponse(analysis) {
  const { entities } = analysis;

  if (entities.courseCode) {
    return {
      text: `I see you're asking about ${entities.courseCode}. Let me check the schedule for this course...\n\nWould you like me to show you all exams for this course or just the upcoming ones?`,
      suggestions: [
        `Show ${entities.courseCode} schedule`,
        'Find all courses',
        'Check course conflicts'
      ],
      actions: [
        {
          type: 'filter_course',
          label: `View ${entities.courseCode}`,
          data: { courseCode: entities.courseCode }
        }
      ]
    };
  }

  return {
    text: "I can help you find information about specific courses. Try mentioning a course code like 'CS101' or ask me to show all available courses.",
    suggestions: [
      'Show all courses',
      'Find course by code',
      'List upcoming courses'
    ]
  };
}

// Generate venue-specific response
function generateVenueResponse(analysis) {
  return {
    text: "I can help you find exams by venue or location. You can ask me things like:\n\n• 'Where is CS101 exam?'\n• 'Show exams in Main Building'\n• 'What venues are available?'\n\nTry asking about a specific venue or location!",
    suggestions: [
      'Show all venues',
      'Find exam locations',
      'Check venue availability'
    ]
  };
}

// Generate reminder response
function generateReminderResponse(data) {
  return {
    text: "🔔 I can help you set up reminders for your exams! I can notify you:\n\n⏰ **24 hours before** each exam\n⏰ **1 hour before** each exam\n📅 **Daily reminders** for upcoming exams\n⚠️ **Conflict alerts** when detected\n\nWould you like me to set up reminders for your upcoming exams?",
    suggestions: [
      'Set up exam reminders',
      'Configure notification preferences',
      'Test notification system'
    ],
    actions: [
      {
        type: 'setup_reminders',
        label: 'Set Up Reminders',
        data: {}
      }
    ]
  };
}

export default router;
