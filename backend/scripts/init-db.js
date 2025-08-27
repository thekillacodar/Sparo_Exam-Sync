import { initializeDatabase, runQuery } from '../config/database.js';
import bcrypt from 'bcryptjs';
import { config } from '../config/environment.js';

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Hash password for sample users
    const saltRounds = config.BCRYPT_ROUNDS;
    const hashedPassword = await bcrypt.hash('demo123', saltRounds);

    // Insert demo users (matching frontend expectations)
    console.log('👤 Creating demo users...');
    const users = [
      {
        email: 'student@exam.com',
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Student',
        role: 'student'
      },
      {
        email: 'admin@exam.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin'
      },
      {
        email: 'lecturer@exam.com',
        password: hashedPassword,
        firstName: 'Dr. Jane',
        lastName: 'Smith',
        role: 'lecturer'
      }
    ];

    for (const user of users) {
      try {
        await runQuery(`
          INSERT INTO users (email, password_hash, first_name, last_name, role)
          VALUES (?, ?, ?, ?, ?)
        `, [user.email, user.password, user.firstName, user.lastName, user.role]);
        console.log(`✅ Created user: ${user.email} (${user.role})`);
      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          console.log(`ℹ️  User ${user.email} already exists`);
        } else {
          throw error;
        }
      }
    }

    // Insert sample exams
    console.log('📚 Creating sample exams...');
    const exams = [
      {
        courseCode: 'CS101',
        courseName: 'Introduction to Programming',
        date: '2024-12-15',
        time: '09:00',
        venue: 'Room 101, CS Building',
        duration: 120
      },
      {
        courseCode: 'MATH201',
        courseName: 'Calculus II',
        date: '2024-12-17',
        time: '14:00',
        venue: 'Hall A, Main Building',
        duration: 180
      },
      {
        courseCode: 'PHY301',
        courseName: 'Quantum Physics',
        date: '2024-12-20',
        time: '10:30',
        venue: 'Lab 205, Physics Building',
        duration: 150
      },
      {
        courseCode: 'ENG102',
        courseName: 'Technical Writing',
        date: '2024-12-22',
        time: '11:00',
        venue: 'Room 301, Liberal Arts',
        duration: 120
      },
      {
        courseCode: 'CHEM201',
        courseName: 'Organic Chemistry',
        date: '2024-12-25',
        time: '13:30',
        venue: 'Lab 102, Chemistry Building',
        duration: 180
      }
    ];

    for (const exam of exams) {
      try {
        await runQuery(`
          INSERT INTO exams (course_code, course_name, date, time, venue, duration, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [exam.courseCode, exam.courseName, exam.date, exam.time, exam.venue, exam.duration, 2]); // Admin user
        console.log(`✅ Created exam: ${exam.courseCode} - ${exam.courseName}`);
      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          console.log(`ℹ️  Exam ${exam.courseCode} already exists`);
        } else {
          throw error;
        }
      }
    }

    // Insert sample notifications
    console.log('🔔 Creating sample notifications...');
    const notifications = [
      {
        userId: 1,
        title: 'Exam Reminder',
        message: 'CS101 exam is tomorrow at 9:00 AM in Room 101',
        type: 'reminder'
      },
      {
        userId: 1,
        title: 'Schedule Conflict Detected',
        message: 'Potential conflict between MATH201 and PHY301 on the same day',
        type: 'warning'
      },
      {
        userId: 2,
        title: 'Timetable Synced',
        message: 'Your timetable has been successfully synced',
        type: 'success'
      }
    ];

    for (const notification of notifications) {
      try {
        await runQuery(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (?, ?, ?, ?)
        `, [notification.userId, notification.title, notification.message, notification.type]);
        console.log(`✅ Created notification: ${notification.title}`);
      } catch (error) {
        console.log(`ℹ️  Notification already exists or error: ${error.message}`);
      }
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('📋 Demo Credentials (matching frontend):');
    console.log('   Student: student@exam.com / demo123');
    console.log('   Admin: admin@exam.com / demo123');
    console.log('   Lecturer: lecturer@exam.com / demo123');
    console.log('');
    console.log('💡 These credentials work with the existing frontend login!');

  } catch (error) {
    console.error('❌ Error during database seeding:', error);
    throw error;
  }
}

// Run the seeding if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('✅ Database initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };
