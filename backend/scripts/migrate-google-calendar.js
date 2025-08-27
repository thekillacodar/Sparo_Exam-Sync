import { runQuery } from '../config/database.js';

/**
 * Migration script to add Google Calendar integration fields to existing users table
 * Run this script once to update the database schema for Google Calendar integration
 */

async function migrateGoogleCalendarFields() {
  try {
    console.log('🔄 Starting Google Calendar migration...');

    // Check if google_tokens column exists
    const googleTokensColumn = await runQuery(`
      PRAGMA table_info(users)
    `).then(() => {
      return runQuery(`
        SELECT COUNT(*) as count
        FROM pragma_table_info('users')
        WHERE name = 'google_tokens'
      `);
    }).catch(() => ({ count: 0 }));

    if (googleTokensColumn.count === 0) {
      console.log('📝 Adding google_tokens column...');
      await runQuery(`
        ALTER TABLE users ADD COLUMN google_tokens TEXT
      `);
      console.log('✅ google_tokens column added');
    } else {
      console.log('ℹ️ google_tokens column already exists');
    }

    // Check if google_connected column exists
    const googleConnectedColumn = await runQuery(`
      SELECT COUNT(*) as count
      FROM pragma_table_info('users')
      WHERE name = 'google_connected'
    `).catch(() => ({ count: 0 }));

    if (googleConnectedColumn.count === 0) {
      console.log('📝 Adding google_connected column...');
      await runQuery(`
        ALTER TABLE users ADD COLUMN google_connected BOOLEAN DEFAULT 0
      `);
      console.log('✅ google_connected column added');
    } else {
      console.log('ℹ️ google_connected column already exists');
    }

    console.log('🎉 Google Calendar migration completed successfully!');
    console.log('📋 Users can now connect their Google Calendar accounts');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('💡 This might happen if the database is locked or if you have insufficient permissions');
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateGoogleCalendarFields()
    .then(() => {
      console.log('\n✅ Migration completed! You can now use Google Calendar integration.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error.message);
      process.exit(1);
    });
}

export { migrateGoogleCalendarFields };
