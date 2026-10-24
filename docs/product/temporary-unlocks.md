# Temporary Unlock Feature

## Overview

The Temporary Unlock feature allows administrators to grant users temporary permission to edit time entries in locked periods (past the lockDay). This is useful when corrections are needed after a period has been locked for billing or reporting.

## Key Features

- **Admin-only operation**: Only users with roleId=1 (Admin) can grant or revoke unlocks
- **Time-limited**: Maximum 24-hour unlock window
- **Fully audited**: All edits made during the unlock window are tracked
- **Auto-expiry**: Unlocks automatically expire after the duration
- **Manual revocation**: Admins can revoke an unlock before it expires
- **Comprehensive tracking**: Records CREATE, UPDATE, and DELETE operations with before/after snapshots

## Database Schema

### TemporaryUnlock Table
```sql
CREATE TABLE temporary_unlocks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,              -- User receiving the unlock
  clientId INT NOT NULL,             -- Client for which unlock is granted
  grantedBy INT NOT NULL,            -- Admin who granted the unlock
  periodYear INT NOT NULL,           -- Year of the locked period
  periodMonth INT NOT NULL,          -- Month of the locked period (1-12)
  reason TEXT NOT NULL,              -- Reason for granting (min 5 chars)
  expiresAt DATETIME NOT NULL,       -- When the unlock expires
  revokedAt DATETIME NULL,           -- When manually revoked (if applicable)
  createdAt DATETIME DEFAULT NOW(),

  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (grantedBy) REFERENCES users(id),

  INDEX idx_user_client (userId, clientId),
  INDEX idx_expires (expiresAt),
  INDEX idx_period (userId, clientId, periodYear, periodMonth)
);
```

### TemporaryUnlockEdit Table
```sql
CREATE TABLE temporary_unlock_edits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  temporaryUnlockId INT NOT NULL,    -- Reference to the unlock
  timeEntryId INT NULL,              -- The entry that was edited (null for failed operations)
  action VARCHAR(191) NOT NULL,      -- CREATE, UPDATE, or DELETE
  previousData JSON NULL,            -- State before edit (for UPDATE/DELETE)
  newData JSON NULL,                 -- State after edit (for CREATE/UPDATE)
  createdAt DATETIME DEFAULT NOW(),

  FOREIGN KEY (temporaryUnlockId) REFERENCES temporary_unlocks(id) ON DELETE CASCADE,
  INDEX idx_unlock (temporaryUnlockId)
);
```

## API Endpoints

All endpoints require authentication (`authMiddleware`) and admin role (`adminMiddleware`).

### 1. Grant Temporary Unlock

**POST** `/api/admin/temporary-unlocks`

Grants a temporary unlock to a user for a specific client and period.

**Request Body:**
```json
{
  "userId": 10,
  "clientId": 5,
  "periodYear": 2026,
  "periodMonth": 1,
  "reason": "Correção de horas reportadas incorretamente",
  "durationHours": 12
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 100,
    "userId": 10,
    "clientId": 5,
    "grantedBy": 1,
    "periodYear": 2026,
    "periodMonth": 1,
    "reason": "Correção de horas reportadas incorretamente",
    "expiresAt": "2026-02-09T19:30:00.000Z",
    "revokedAt": null,
    "createdAt": "2026-02-09T07:30:00.000Z"
  }
}
```

**Validation Rules:**
- `userId`, `clientId`, `periodYear`, `periodMonth`, `reason` are required
- `reason` must be at least 5 characters
- `periodMonth` must be 1-12
- `periodYear` must be 2000-2100
- `durationHours` max is 24 (defaults to 24 if not provided)
- User must exist and be active
- Client must exist and be active
- User must be assigned to the client
- Cannot have another active unlock for the same user/client/period

---

### 2. Revoke Temporary Unlock

**POST** `/api/admin/temporary-unlocks/:id/revoke`

Revokes an active unlock before it expires.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 100,
    "revokedAt": "2026-02-09T10:00:00.000Z",
    ...
  }
}
```

**Errors:**
- 404 if unlock not found
- 400 if already revoked or expired

---

### 3. List Temporary Unlocks

**GET** `/api/admin/temporary-unlocks`

Lists all temporary unlocks with optional filters.

**Query Parameters:**
- `userId` (optional): Filter by user
- `clientId` (optional): Filter by client
- `activeOnly` (optional): `true` to show only active (not revoked, not expired)
- `page` (optional): Page number (default 1)
- `limit` (optional): Items per page (default 20, max 50)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 100,
      "userId": 10,
      "userName": "João Silva",
      "clientId": 5,
      "clientName": "Cliente ABC",
      "grantedBy": 1,
      "adminName": "Admin User",
      "periodYear": 2026,
      "periodMonth": 1,
      "reason": "Correção necessária",
      "expiresAt": "2026-02-09T19:30:00.000Z",
      "revokedAt": null,
      "createdAt": "2026-02-09T07:30:00.000Z",
      "editCount": 3
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

---

### 4. Get Temporary Unlock Details

**GET** `/api/admin/temporary-unlocks/:id`

Gets detailed information about a specific unlock, including all edits made.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 100,
    "userId": 10,
    "userName": "João Silva",
    "clientId": 5,
    "clientName": "Cliente ABC",
    "grantedBy": 1,
    "adminName": "Admin User",
    "periodYear": 2026,
    "periodMonth": 1,
    "reason": "Correção necessária",
    "expiresAt": "2026-02-09T19:30:00.000Z",
    "revokedAt": null,
    "createdAt": "2026-02-09T07:30:00.000Z",
    "edits": [
      {
        "id": 1,
        "temporaryUnlockId": 100,
        "timeEntryId": 5000,
        "action": "UPDATE",
        "previousData": {
          "duration": 60,
          "description": "Reunião cliente"
        },
        "newData": {
          "duration": 90,
          "description": "Reunião cliente - atualizado"
        },
        "createdAt": "2026-02-09T08:00:00.000Z"
      },
      {
        "id": 2,
        "temporaryUnlockId": 100,
        "timeEntryId": 5001,
        "action": "DELETE",
        "previousData": {
          "duration": 30,
          "description": "Entrada duplicada"
        },
        "newData": null,
        "createdAt": "2026-02-09T08:15:00.000Z"
      }
    ]
  }
}
```

**Errors:**
- 404 if unlock not found

---

## Service Functions

### grantTemporaryUnlock

Grants a temporary unlock with full validation.

```typescript
const unlock = await grantTemporaryUnlock({
  userId: 10,
  clientId: 5,
  grantedBy: 1,
  periodYear: 2026,
  periodMonth: 1,
  reason: 'Correção necessária',
  durationHours: 12 // optional, defaults to 24
});
```

### revokeTemporaryUnlock

Revokes an active unlock.

```typescript
const unlock = await revokeTemporaryUnlock(unlockId, adminUserId);
```

### hasActiveTemporaryUnlock

Checks if a user has an active unlock for a specific entry. Used internally by timeentry.service.

```typescript
const unlock = await hasActiveTemporaryUnlock(userId, clientId, entryDate);
if (unlock) {
  // User can edit despite lock
  const tempUnlockId = unlock.unlockId;
}
```

### recordTemporaryUnlockEdit

Records an edit made during an unlock window. Called automatically by timeentry.service.

```typescript
await recordTemporaryUnlockEdit({
  temporaryUnlockId: 100,
  timeEntryId: 5000,
  action: 'UPDATE',
  previousData: { duration: 60, description: 'Old' },
  newData: { duration: 90, description: 'New' }
});
```

### listTemporaryUnlocks

Lists unlocks with pagination and filters.

```typescript
const result = await listTemporaryUnlocks({
  userId: 10,
  activeOnly: true,
  page: 1,
  limit: 20
});
```

### getTemporaryUnlockDetails

Gets full details including all edits.

```typescript
const details = await getTemporaryUnlockDetails(unlockId);
```

---

## Integration with Time Entry Service

The temporary unlock check is integrated into `timeentry.service.ts`:

### Create Entry
```typescript
let tempUnlockId: number | null = null;
if (isEntryLocked(data.date, lockDay)) {
  const tempUnlock = await hasActiveTemporaryUnlock(data.userId, data.clientId, data.date);
  if (!tempUnlock) {
    throw new ForbiddenError('Time entry month is locked');
  }
  tempUnlockId = tempUnlock.unlockId;
}

const entry = await prisma.timeEntry.create({ ... });

if (tempUnlockId) {
  await recordTemporaryUnlockEdit({
    temporaryUnlockId: tempUnlockId,
    timeEntryId: entry.id,
    action: 'CREATE',
    newData: { ... }
  });
}
```

### Update Entry
Similar logic, but captures `previousData` before update.

### Delete Entry
Captures full entry data in `previousData` before deletion.

---

## Frontend Integration

The admin interface is available at `/admin/temporary-unlocks` (AdminTemporaryUnlocksPage.tsx):

**Features:**
- List all unlocks with status badges (Active/Expired/Revoked)
- Filter by active-only
- Grant new unlock form with validation
- View edit history with before/after diff
- Revoke active unlocks
- Dark mode support

**Status Indicators:**
- **Green**: Active (not expired, not revoked)
- **Yellow**: Expired (past expiresAt)
- **Red**: Revoked (manually revoked by admin)

---

## Audit Trail

All unlock operations are logged to the `audit_log` table:

- **TEMPORARY_UNLOCK_GRANT**: When an unlock is granted
- **TEMPORARY_UNLOCK_REVOKE**: When an unlock is revoked
- All edits are also recorded in `temporary_unlock_edits` for detailed review

---

## Best Practices

1. **Always provide a clear reason**: The reason field is auditable and helps track why unlocks were granted
2. **Use shortest duration necessary**: Don't default to 24 hours if user only needs a few hours
3. **Review edit history**: Check the edits before approving timesheets
4. **Revoke when done**: If user finishes early, revoke the unlock to prevent accidental edits
5. **Monitor usage**: Frequent unlocks for the same user/client may indicate process issues

---

## Security Considerations

- Only admins can grant/revoke unlocks
- Unlocks are specific to user + client + period (cannot be reused)
- All edits are permanently tracked in the database
- Audit logs record who granted and who revoked each unlock
- Lock bypass only works when there's an active unlock (automatic re-lock after expiry/revocation)
