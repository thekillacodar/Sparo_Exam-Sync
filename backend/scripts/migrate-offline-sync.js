import { runQuery } from '../config/database.js';

/**
 * Migration script to add offline sync table to existing databases
 * Run this script once to add offline synchronization support
 */

async function migrateOfflineSyncTable() {
  try {
    console.log('🔄 Starting offline sync migration...');

    // Check if offline_pending_changes table exists
    const tableExists = await runQuery(`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='table' AND name='offline_pending_changes'
    `).catch(() => ({ count: 0 }));

    if (tableExists.count > 0) {
      console.log('ℹ️ Offline sync table already exists');
      console.log('✅ Migration completed - no changes needed');
      return;
    }

    // Create the offline_pending_changes table
    console.log('📝 Creating offline_pending_changes table...');
    await runQuery(`
      CREATE TABLE offline_pending_changes (
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
    `);

    // Create index for better performance
    console.log('📝 Creating indexes for offline sync table...');
    await runQuery(`
      CREATE INDEX IF NOT EXISTS idx_offline_changes_user_id
      ON offline_pending_changes(user_id)
    `);

    await runQuery(`
      CREATE INDEX IF NOT EXISTS idx_offline_changes_type
      ON offline_pending_changes(change_type)
    `);

    await runQuery(`
      CREATE INDEX IF NOT EXISTS idx_offline_changes_created_at
      ON offline_pending_changes(created_at)
    `);

    console.log('✅ Offline sync table created successfully');
    console.log('📋 Offline synchronization is now ready!');
    console.log('💡 Users can now work offline and sync changes when connection is restored');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('💡 This might happen if the database is locked or if you have insufficient permissions');
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateOfflineSyncTable()
    .then(() => {
      console.log('\n✅ Migration completed! Offline sync is now available.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error.message);
      process.exit(1);
    });
}

export { migrateOfflineSyncTable };
