// Validation middleware for API requests

// Exam validation schema
export const validateExamData = (req, res, next) => {
  const { courseCode, courseName, date, time, venue, duration, status } = req.body;

  const errors = [];

  // Required fields validation
  if (!courseCode || typeof courseCode !== 'string' || courseCode.trim().length === 0) {
    errors.push('courseCode is required and must be a non-empty string');
  }

  if (!courseName || typeof courseName !== 'string' || courseName.trim().length === 0) {
    errors.push('courseName is required and must be a non-empty string');
  }

  // Date validation
  if (!date) {
    errors.push('date is required');
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      errors.push('date must be in YYYY-MM-DD format');
    } else {
      const examDate = new Date(date);
      if (isNaN(examDate.getTime())) {
        errors.push('date must be a valid date');
      }
    }
  }

  // Time validation
  if (!time) {
    errors.push('time is required');
  } else {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      errors.push('time must be in HH:MM format (24-hour)');
    }
  }

  // Venue validation
  if (!venue || typeof venue !== 'string' || venue.trim().length === 0) {
    errors.push('venue is required and must be a non-empty string');
  }

  // Duration validation
  if (!duration) {
    errors.push('duration is required');
  } else if (typeof duration !== 'number' || duration < 30 || duration > 300) {
    errors.push('duration must be a number between 30 and 300 minutes');
  }

  // Status validation (if provided)
  if (status && !['upcoming', 'ongoing', 'completed', 'cancelled'].includes(status)) {
    errors.push('status must be one of: upcoming, ongoing, completed, cancelled');
  }

  // Length validations
  if (courseCode && courseCode.length > 20) {
    errors.push('courseCode must be 20 characters or less');
  }

  if (courseName && courseName.length > 100) {
    errors.push('courseName must be 100 characters or less');
  }

  if (venue && venue.length > 100) {
    errors.push('venue must be 100 characters or less');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
      received: {
        courseCode: courseCode?.substring(0, 50),
        courseName: courseName?.substring(0, 50),
        date,
        time,
        venue: venue?.substring(0, 50),
        duration,
        status
      }
    });
  }

  next();
};

// User registration validation
export const validateUserRegistration = (req, res, next) => {
  const { email, password, firstName, lastName, role } = req.body;

  const errors = [];

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('Valid email is required');
  }

  // Password validation
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  // Name validations
  if (!firstName || firstName.trim().length === 0) {
    errors.push('First name is required');
  }

  if (!lastName || lastName.trim().length === 0) {
    errors.push('Last name is required');
  }

  // Role validation
  if (!role || !['student', 'lecturer', 'admin'].includes(role)) {
    errors.push('Role must be one of: student, lecturer, admin');
  }

  // Length validations
  if (firstName && firstName.length > 50) {
    errors.push('First name must be 50 characters or less');
  }

  if (lastName && lastName.length > 50) {
    errors.push('Last name must be 50 characters or less');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

// Login validation
export const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  const errors = [];

  if (!email || !password) {
    errors.push('Email and password are required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

// Notification validation
export const validateNotification = (req, res, next) => {
  const { userId, title, message, type } = req.body;

  const errors = [];

  if (!userId || typeof userId !== 'number') {
    errors.push('userId is required and must be a number');
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('title is required and must be a non-empty string');
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    errors.push('message is required and must be a non-empty string');
  }

  if (!type || !['reminder', 'warning', 'success', 'info'].includes(type)) {
    errors.push('type must be one of: reminder, warning, success, info');
  }

  // Length validations
  if (title && title.length > 100) {
    errors.push('title must be 100 characters or less');
  }

  if (message && message.length > 500) {
    errors.push('message must be 500 characters or less');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

// Generic pagination validation
export const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        error: 'page must be a positive integer'
      });
    }
    req.query.page = pageNum;
  }

  if (limit) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: 'limit must be a number between 1 and 100'
      });
    }
    req.query.limit = limitNum;
  }

  next();
};

// Date range validation
export const validateDateRange = (req, res, next) => {
  const { startDate, endDate } = req.params || req.query;

  const errors = [];

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (startDate && !dateRegex.test(startDate)) {
    errors.push('startDate must be in YYYY-MM-DD format');
  }

  if (endDate && !dateRegex.test(endDate)) {
    errors.push('endDate must be in YYYY-MM-DD format');
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      errors.push('startDate must be before or equal to endDate');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Date validation failed',
      details: errors
    });
  }

  next();
};

// Search query validation
export const validateSearchQuery = (req, res, next) => {
  const { query } = req.params;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({
      error: 'Search query is required'
    });
  }

  if (query.length > 100) {
    return res.status(400).json({
      error: 'Search query must be 100 characters or less'
    });
  }

  // Sanitize search query
  req.params.query = query.trim();

  next();
};
