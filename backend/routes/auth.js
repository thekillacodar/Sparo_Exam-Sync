import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getRow, runQuery } from '../config/database.js';
import { config } from '../config/environment.js';

const router = express.Router();

// Input validation helper
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  return password && password.length >= 6;
}

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'student' } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'All fields are required',
        details: {
          email: !email ? 'Email is required' : null,
          password: !password ? 'Password is required' : null,
          firstName: !firstName ? 'First name is required' : null,
          lastName: !lastName ? 'Last name is required' : null
        }
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (!['student', 'lecturer', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be student, lecturer, or admin' });
    }

    // Check if user already exists
    const existingUser = await getRow('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = config.BCRYPT_ROUNDS;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await runQuery(
      'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, firstName, lastName, role]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: result.lastID,
        email: email,
        role: role,
        firstName: firstName,
        lastName: lastName
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token: token,
      user: {
        id: result.lastID,
        email: email,
        firstName: firstName,
        lastName: lastName,
        role: role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await getRow(
      'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Verify token endpoint (for frontend to verify token validity)
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Get current user info
    const user = await getRow(
      'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error during token verification' });
  }
});

export default router;
