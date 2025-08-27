# Offline Synchronization Feature

This document explains how to implement offline data storage and synchronization in ExamSync.

## Overview

The offline sync feature allows users to:
- ✅ **Work offline**: Continue using the app without internet connection
- ✅ **Queue changes**: Store actions locally when offline
- ✅ **Auto-sync**: Automatically sync changes when connection is restored
- ✅ **Conflict resolution**: Handle conflicts when syncing offline changes
- ✅ **Data integrity**: Ensure data consistency between offline and online states

## Architecture

### Backend Components

1. **Offline Sync API** (`/api/offline-sync/`)
   - Snapshot generation for offline caching
   - Change queue processing and synchronization
   - Conflict detection and resolution
   - Pending changes management

2. **Database Tables**
   - `offline_pending_changes`: Stores queued changes for processing
   - Enhanced `exams` and `notifications` tables with sync tracking

3. **Migration Support**
   - Database migration scripts for existing installations

### Frontend Implementation

The frontend should implement:

1. **Local Storage Management**
2. **Network Detection**
3. **Change Queue Management**
4. **Sync Orchestration**

## API Endpoints

### Get Offline Data Snapshot
```http
GET /api/offline-sync/snapshot
Authorization: Bearer <token>
Query Parameters:
- includeExams=true/false
- includeNotifications=true/false
- lastSync=ISO8601_timestamp (optional)
```

**Response:**
```json
{
  "success": true,
  "snapshot": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1a2b3c4d",
    "user": { /* user data */ },
    "data": {
      "exams": [ /* exam data */ ],
      "notifications": [ /* notification data */ ],
      "userPreferences": { /* user settings */ }
    }
  }
}
```

### Sync Offline Changes
```http
POST /api/offline-sync/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "changes": [
    {
      "id": "exam_create_123",
      "type": "exam",
      "action": "create",
      "data": { /* exam data */ },
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "deviceId": "device-uuid",
  "lastSync": "2024-01-15T09:30:00Z"
}
```

### Get Pending Changes
```http
GET /api/offline-sync/pending-changes
Authorization: Bearer <token>
```

### Resolve Pending Change
```http
POST /api/offline-sync/resolve-change/:changeId
Authorization: Bearer <token>
Content-Type: application/json

{
  "resolution": "accept|reject|modify",
  "modifiedData": { /* if resolution is modify */ }
}
```

### Get Queue Status
```http
GET /api/offline-sync/queue-status
Authorization: Bearer <token>
```

## Frontend Implementation Guide

### 1. Network Detection

```javascript
// Network status detection
class NetworkManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleReconnection();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleDisconnection();
    });
  }

  async handleReconnection() {
    console.log('🔗 Network reconnected, starting sync...');
    await this.performSync();
  }

  handleDisconnection() {
    console.log('📶 Network disconnected, switching to offline mode');
    // Show offline indicator
  }

  async performSync() {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      await syncOfflineChanges();
    } finally {
      this.syncInProgress = false;
    }
  }
}
```

### 2. Local Storage Manager

```javascript
class OfflineStorage {
  constructor() {
    this.STORAGE_KEYS = {
      OFFLINE_DATA: 'examSync_offline_data',
      PENDING_CHANGES: 'examSync_pending_changes',
      LAST_SYNC: 'examSync_last_sync',
      USER_PREFERENCES: 'examSync_user_prefs'
    };
  }

  // Store offline data snapshot
  async storeSnapshot(snapshot) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.OFFLINE_DATA,
        JSON.stringify(snapshot));
      localStorage.setItem(this.STORAGE_KEYS.LAST_SYNC,
        snapshot.timestamp);
    } catch (error) {
      console.error('Failed to store offline snapshot:', error);
    }
  }

  // Get offline data
  getOfflineData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.OFFLINE_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get offline data:', error);
      return null;
    }
  }

  // Queue change for offline sync
  async queueChange(change) {
    try {
      const pendingChanges = this.getPendingChanges();
      pendingChanges.push({
        ...change,
        id: `${change.type}_${change.action}_${Date.now()}`,
        timestamp: new Date().toISOString(),
        deviceId: this.getDeviceId()
      });

      localStorage.setItem(this.STORAGE_KEYS.PENDING_CHANGES,
        JSON.stringify(pendingChanges));

      // Attempt immediate sync if online
      if (navigator.onLine) {
        await this.attemptSync();
      }
    } catch (error) {
      console.error('Failed to queue change:', error);
    }
  }

  // Get pending changes
  getPendingChanges() {
    try {
      const changes = localStorage.getItem(this.STORAGE_KEYS.PENDING_CHANGES);
      return changes ? JSON.parse(changes) : [];
    } catch (error) {
      console.error('Failed to get pending changes:', error);
      return [];
    }
  }

  // Clear pending changes after successful sync
  clearPendingChanges() {
    localStorage.removeItem(this.STORAGE_KEYS.PENDING_CHANGES);
  }

  // Get device ID for tracking changes
  getDeviceId() {
    let deviceId = localStorage.getItem('examSync_device_id');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('examSync_device_id', deviceId);
    }
    return deviceId;
  }
}
```

### 3. Sync Orchestrator

```javascript
class SyncOrchestrator {
  constructor(storage, networkManager) {
    this.storage = storage;
    this.networkManager = networkManager;
    this.isOnline = navigator.onLine;
  }

  // Main sync function
  async performSync() {
    if (!this.isOnline) {
      console.log('📶 Skipping sync - offline');
      return;
    }

    const pendingChanges = this.storage.getPendingChanges();
    if (pendingChanges.length === 0) {
      console.log('📋 No pending changes to sync');
      return;
    }

    try {
      console.log(`🔄 Syncing ${pendingChanges.length} changes...`);

      const response = await fetch('/api/offline-sync/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          changes: pendingChanges,
          deviceId: this.storage.getDeviceId(),
          lastSync: localStorage.getItem('examSync_last_sync')
        })
      });

      const result = await response.json();

      if (result.success) {
        // Clear successful changes
        this.storage.clearPendingChanges();

        // Update offline snapshot
        await this.updateOfflineSnapshot();

        console.log(`✅ Sync completed: ${result.results.summary.successful} successful`);

        // Handle conflicts if any
        if (result.results.conflicts.length > 0) {
          await this.handleConflicts(result.results.conflicts);
        }
      } else {
        console.error('❌ Sync failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
    }
  }

  // Update offline data snapshot
  async updateOfflineSnapshot() {
    try {
      const response = await fetch('/api/offline-sync/snapshot', {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      const result = await response.json();
      if (result.success) {
        await this.storage.storeSnapshot(result.snapshot);
      }
    } catch (error) {
      console.error('Failed to update offline snapshot:', error);
    }
  }

  // Handle sync conflicts
  async handleConflicts(conflicts) {
    for (const conflict of conflicts) {
      // Show conflict resolution UI
      const resolution = await this.promptConflictResolution(conflict);

      if (resolution) {
        await this.resolveConflict(conflict.changeId, resolution);
      }
    }
  }

  // Prompt user for conflict resolution
  async promptConflictResolution(conflict) {
    // Show conflict dialog to user
    return new Promise((resolve) => {
      // Implementation depends on your UI framework
      const userChoice = window.confirm(
        `Conflict detected: ${conflict.message}\n\nResolve conflict?`
      );
      resolve(userChoice ? 'accept' : 'reject');
    });
  }

  // Resolve conflict
  async resolveConflict(changeId, resolution) {
    try {
      await fetch(`/api/offline-sync/resolve-change/${changeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ resolution })
      });
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    }
  }

  // Get auth token (implement based on your auth system)
  getAuthToken() {
    return localStorage.getItem('auth_token');
  }
}
```

### 4. Integration Example

```javascript
// Initialize offline sync
const storage = new OfflineStorage();
const networkManager = new NetworkManager();
const syncOrchestrator = new SyncOrchestrator(storage, networkManager);

// Load offline data on app start
async function initializeOfflineSupport() {
  // Load cached data
  const offlineData = storage.getOfflineData();
  if (offlineData) {
    // Use offline data to render UI
    renderOfflineData(offlineData);
  }

  // Start sync if online
  if (navigator.onLine) {
    await syncOrchestrator.performSync();
  }
}

// Queue changes when offline
function createExamOffline(examData) {
  if (!navigator.onLine) {
    storage.queueChange({
      type: 'exam',
      action: 'create',
      data: examData
    });
    // Update local UI optimistically
    updateLocalUI(examData);
  } else {
    // Normal online flow
    createExamOnline(examData);
  }
}

// Periodic sync (every 5 minutes when online)
setInterval(() => {
  if (navigator.onLine) {
    syncOrchestrator.performSync();
  }
}, 5 * 60 * 1000);
```

## Database Migration

For existing installations, run the migration script:

```bash
cd backend
npm run migrate:offline-sync
```

This will:
- ✅ Create the `offline_pending_changes` table
- ✅ Add necessary indexes for performance
- ✅ Enable offline synchronization features

## Best Practices

### 1. Conflict Resolution
- **Last Write Wins**: Automatically resolve conflicts based on timestamp
- **User Choice**: Let user decide which version to keep
- **Merge Strategy**: Combine changes when possible

### 2. Data Consistency
- **Version Control**: Use data versioning to detect changes
- **Optimistic Updates**: Update UI immediately, rollback on sync failure
- **Delta Sync**: Only sync changed data to reduce bandwidth

### 3. User Experience
- **Offline Indicators**: Show when app is in offline mode
- **Sync Status**: Display sync progress and results
- **Conflict Notifications**: Alert users about conflicts requiring resolution

### 4. Performance
- **Batch Operations**: Group multiple changes into single sync request
- **Compression**: Compress offline data to save storage space
- **Cleanup**: Remove old offline data periodically

## Troubleshooting

### Common Issues

1. **Changes not syncing**
   - Check network connectivity
   - Verify authentication token validity
   - Check browser storage quota

2. **Data inconsistencies**
   - Clear offline data and re-sync
   - Check for conflicting changes
   - Verify database integrity

3. **Storage quota exceeded**
   - Implement data cleanup strategies
   - Compress stored data
   - Use IndexedDB for larger storage needs

### Debug Mode

Enable debug logging:
```javascript
localStorage.setItem('examSync_debug', 'true');
```

This will enable detailed logging for offline sync operations.

## Security Considerations

- **Data Encryption**: Encrypt sensitive offline data
- **Token Security**: Securely store authentication tokens
- **Data Validation**: Validate offline data before syncing
- **Rate Limiting**: Implement sync rate limiting to prevent abuse

## Next Steps

- Implement IndexedDB for larger offline storage
- Add real-time sync using WebSockets
- Implement conflict-free replicated data types (CRDT)
- Add offline analytics and usage tracking

This offline sync implementation provides a solid foundation for mobile and web applications that need to work reliably with intermittent connectivity.
