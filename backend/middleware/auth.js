import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { getRow } from '../config/database.js';

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user info to request
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please provide a valid JWT token in Authorization header'
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Get current user info from database
    const user = await getRow(
      'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'The user associated with this token no longer exists'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        error: 'Account deactivated',
        message: 'Your account has been deactivated. Please contact administrator.'
      });
    }

    // Attach user info to request object
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid or malformed'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.'
      });
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Role-based authorization middleware factory
 * Creates middleware that checks if user has required role(s)
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        requiredRoles: allowedRoles,
        currentRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user info if token is valid, but doesn't fail if no token
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.JWT_SECRET);

    const user = await getRow(
      'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (user && user.is_active) {
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    req.user = null;
    next();
  }
};

/**
 * Admin-only middleware
 */
export const requireAdmin = requireRole('admin');

/**
 * Lecturer or Admin middleware
 */
export const requireLecturerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }

  if (!['lecturer', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'This action requires lecturer or admin privileges',
      requiredRoles: ['lecturer', 'admin'],
      currentRole: req.user.role
    });
  }

  next();
};
