import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path configuration
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/exam-sync.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Database initialization function
export async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // Create users table
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('student', 'lecturer', 'admin')),
        is_active BOOLEAN DEFAULT 1,
        google_tokens TEXT,
        google_connected BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create exams table
    const createExamsTable = `
      CREATE TABLE IF NOT EXISTS exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_code TEXT NOT NULL,
        course_name TEXT NOT NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        venue TEXT NOT NULL,
        duration INTEGER NOT NULL CHECK (duration > 0),
        status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
      )
    `;

    // Create notifications table
    const createNotificationsTable = `
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('reminder', 'warning', 'success', 'info')),
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `;

    // Create exam conflicts table for tracking scheduling conflicts
    const createConflictsTable = `
      CREATE TABLE IF NOT EXISTS exam_conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam1_id INTEGER NOT NULL,
        exam2_id INTEGER NOT NULL,
        conflict_type TEXT NOT NULL CHECK (conflict_type IN ('time_overlap', 'venue_conflict', 'both')),
        description TEXT,
        resolved BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exam1_id) REFERENCES exams (id),
        FOREIGN KEY (exam2_id) REFERENCES exams (id)
      )
    `;

    // Create offline pending changes table for offline sync
    const createOfflineChangesTable = `
      CREATE TABLE IF NOT EXISTS offline_pending_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        change_id TEXT UNIQUE NOT NULL,
        change_type TEXT NOT NULL CHECK (change_type IN ('exam', 'notification')),
        change_action TEXT NOT NULL,
        change_data TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        device_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `;

    // Create indexes for better performance
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_exams_date ON exams(date);
      CREATE INDEX IF NOT EXISTS idx_exams_course_code ON exams(course_code);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
    `;

    // Execute all table creations in sequence
    db.serialize(() => {
      db.run(createUsersTable, (err) => {
        if (err) {
          console.error('Error creating users table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Users table ready');
      });

      db.run(createExamsTable, (err) => {
        if (err) {
          console.error('Error creating exams table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Exams table ready');
      });

      db.run(createNotificationsTable, (err) => {
        if (err) {
          console.error('Error creating notifications table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Notifications table ready');
      });

      db.run(createConflictsTable, (err) => {
        if (err) {
          console.error('Error creating conflicts table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Conflicts table ready');
      });

      db.run(createOfflineChangesTable, (err) => {
        if (err) {
          console.error('Error creating offline changes table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Offline changes table ready');
      });

      db.run(createIndexes, (err) => {
        if (err) {
          console.error('Error creating indexes:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Database indexes ready');
        resolve();
      });
    });
  });
}

// Helper function to run database queries as promises
export function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// Helper function to get single row
export function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Helper function to get all rows
export function getAllRows(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Export database instance for direct use if needed
export { db };

// Graceful database shutdown
process.on('exit', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
  });
});
