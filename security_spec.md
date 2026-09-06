# Security Specification: Remixo Gemini-Companion

This document establishes the formal security contract, mathematical data invariants, adversarial test fixtures ("The Dirty Dozen"), and automated rules test harness for Cloud Firestore in the **Remixo Gemini-Companion** application.

---

## 1. System-Wide Data Invariants

### Architectural Isolation & Identity Boundaries
1. **Zero-Trust User Data Isolation**: Every resource belongs exclusively to an authenticated user and must reside under `/users/{userId}/*`. Cross-user data access is strictly forbidden (`request.auth.uid == userId`).
2. **Immutable Identity Invariant**: Once created, a document's `id`, `userId`, and `createdAt` are permanently immutable (`incoming().userId == existing().userId && incoming().createdAt == existing().createdAt`).
3. **No Unauthenticated Execution**: All read, write, create, update, and delete actions require `request.auth != null`.
4. **Verified Credentials**: Write operations require `request.auth.token.email_verified == true` for standard identity accounts.
5. **Path ID Hardening**: All document path keys must strictly conform to `^[a-zA-Z0-9_\-]+$` with a length of $\le 128$ characters (`isValidId(id)`).
6. **Zero-Crash Payload Hygiene**: No document may contain undefined values or exceed Firestore maximum document bounds (1 MB). All string fields have explicit `size() <= N` bounds and array fields have explicit length constraints.
7. **Action-Based Update Authorization**: Updates must specify exact modified fieldsets via `affectedKeys().hasOnly([...])`, guaranteeing that attackers cannot inject ghost/shadow fields.

---

## 2. Collection Schemas & Field Invariants

### A. `/users/{userId}/entries/{entryId}` (JournalEntry)
- **Required on Create**: `id`, `userId`, `createdAt`, `updatedAt`
- **Field Constraints**:
  - `id`: string, size <= 128, matches `^[a-zA-Z0-9_\-]+$`
  - `userId`: string, strictly matches `request.auth.uid`
  - `title`: string, size <= 256
  - `content`: string, size <= 50000
  - `mood`: string, in `['reflective', 'calm', 'focused', 'energized', 'creative', 'grateful', 'anxious']`
  - `tags`: list, size <= 50, each tag is string <= 50
  - `summary`: string, size <= 4000
  - `sentiment`: string, size <= 128
  - `messages`: list, size <= 500
  - `extractedTasks`: list, size <= 100
  - `extractedEvents`: list, size <= 100
  - `extractedDeadlines`: list, size <= 100
  - `timezone`: string, size <= 64
  - `embedding`: list, size <= 1536
  - `createdAt`: number, `> 0`
  - `updatedAt`: number, `> 0`

### B. `/users/{userId}/tasks/{taskId}` (TaskItem)
- **Required on Create**: `id`, `userId`, `title`, `createdAt`
- **Field Constraints**:
  - `id`: string, size <= 128
  - `userId`: string, strictly matches `request.auth.uid`
  - `title`: string, size >= 1 && size <= 256
  - `description`: string, size <= 4000
  - `priority`: string, in `['low', 'medium', 'high', 'critical']`
  - `category`: string, in `['work', 'personal', 'urgent', 'health', 'learning', 'errand']`
  - `dueDate`: string, size <= 32
  - `dueTime`: string, size <= 16
  - `startTime`: string, size <= 16
  - `endTime`: string, size <= 16
  - `estimatedMinutes`: number, `>= 0 && <= 1440`
  - `completed`: boolean
  - `completedAt`: number, optional
  - `createdAt`: number, `> 0`
  - `subtasks`: list, size <= 50

### C. `/users/{userId}/plans/{planId}` (DailyPlan)
- **Required on Create**: `id`, `userId`, `dateStr`, `createdAt`
- **Field Constraints**:
  - `id`: string, size <= 128
  - `userId`: string, strictly matches `request.auth.uid`
  - `dateStr`: string, matches `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`
  - `blocks`: list, size <= 100
  - `summary`: string, size <= 3000
  - `energyStrategy`: string, size <= 1000
  - `totalFocusMinutes`: number, `>= 0 && <= 1440`
  - `totalBreakMinutes`: number, `>= 0 && <= 1440`
  - `createdAt`: number, `> 0`
  - `updatedAt`: number, `> 0`

### D. `/users/{userId}/focusSessions/{sessionId}` (FocusSession)
- **Required on Create**: `id`, `userId`, `durationMinutes`, `completedAt`
- **Field Constraints**:
  - `id`: string, size <= 128
  - `userId`: string, strictly matches `request.auth.uid`
  - `durationMinutes`: number, `>= 1 && <= 720`
  - `taskTitle`: string, size <= 256
  - `taskId`: string, size <= 128
  - `interrupted`: boolean, optional
  - `notes`: string, size <= 2000, optional
  - `completedAt`: number, `> 0`

### E. `/users/{userId}/insights/{reviewId}` (DailyReview)
- **Required on Create**: `id`, `userId`, `dateStr`, `type`, `createdAt`
- **Field Constraints**:
  - `id`: string, size <= 128
  - `userId`: string, strictly matches `request.auth.uid`
  - `dateStr`: string, matches `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`
  - `type`: string, in `['morning_brief', 'evening_review']`
  - `headline`: string, size <= 256
  - `summary`: string, size <= 4000
  - `highlights`: list, size <= 30
  - `recommendations`: list, size <= 30
  - `productivityScore`: number, `>= 0 && <= 100`
  - `createdAt`: number, `> 0`

### F. `/users/{userId}/preferences/{prefId}` (UserPreferences)
- **Field Constraints**:
  - Document ID is constrained to `['settings', 'main']`
  - `name`: string, size <= 128
  - `language`: string, size <= 16
  - `timeFormat`: string, in `['12h', '24h']`
  - `timezone`: string, size <= 64
  - `workingDays`: list, size <= 7
  - `defaultTaskDuration`: number, `>= 5 && <= 240`
  - `defaultBreakDuration`: number, `>= 1 && <= 120`
  - `notificationsEnabled`: boolean
  - `aiMemoryEnabled`: boolean

### G. `/users/{userId}/events/{eventId}` (CalendarEvent)
- **Required on Create**: `id`, `userId`, `title`, `date`, `startTime`, `endTime`, `createdAt`, `updatedAt`
- **Field Constraints**:
  - `id`: string, size <= 128
  - `userId`: string, strictly matches `request.auth.uid`
  - `title`: string, size >= 1 && size <= 256
  - `description`: string, size <= 4000
  - `date`: string, matches `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`
  - `startTime`: string, size <= 16
  - `endTime`: string, size <= 16
  - `location`: string, size <= 256
  - `priority`: string, in `['low', 'medium', 'high', 'critical']`
  - `repeat`: map, optional
  - `reminder`: list, size <= 10
  - `color`: string, size <= 32
  - `createdAt`: number, `> 0`
  - `updatedAt`: number, `> 0`

### H. `/users/{userId}/notifications/{notificationId}` (NotificationItem)
- **Required on Create**: `id`, `userId`, `title`, `scheduledAt`, `priority`, `status`, `createdAt`
- **Field Constraints**:
  - `id`: string, size <= 128
  - `userId`: string, strictly matches `request.auth.uid`
  - `title`: string, size >= 1 && size <= 300
  - `message`: string, size <= 2000
  - `scheduledAt`: number, `> 0`
  - `priority`: string, in `['low', 'normal', 'high', 'urgent']`
  - `status`: string, in `['pending', 'unread', 'read', 'snoozed', 'dismissed']`
  - `relatedTaskId`: string, size <= 128, optional
  - `relatedEventId`: string, size <= 128, optional
  - `createdAt`: number, `> 0`

### I. `/users/{userId}/memories/{memoryId}` (JournalMemory)
- **Required on Create**: `id`, `userId`, `entryId`, `title`, `createdAt`
- **Field Constraints**:
  - `id`: string, size <= 128
  - `userId`: string, strictly matches `request.auth.uid`
  - `entryId`: string, size <= 128
  - `title`: string, size <= 256
  - `content`: string, size <= 50000
  - `summary`: string, size <= 4000, optional
  - `embedding`: list, size <= 1536
  - `createdAt`: number, `> 0`

---

## 3. The "Dirty Dozen" Adversarial Payloads

The following 12 adversarial test payloads are designed to attack Identity, Integrity, and State boundaries. Each MUST result in `PERMISSION_DENIED`.

### Attack 1: Cross-User Identity Spoofing (Write to Another User's Collection)
Attacker `user_bob` attempts to create a journal entry directly under `user_alice`'s namespace.
```json
{
  "targetPath": "/users/user_alice/entries/entry_999",
  "auth": { "uid": "user_bob", "token": { "email_verified": true } },
  "payload": {
    "id": "entry_999",
    "userId": "user_bob",
    "title": "Malicious Probe",
    "content": "Infiltrating Alice's journal",
    "createdAt": 1725450000000,
    "updatedAt": 1725450000000
  }
}
```
**Expected Outcome**: `PERMISSION_DENIED` (`request.auth.uid != userId`).

### Attack 2: Internal UID Masquerading
Attacker `user_alice` posts to their own collection path `/users/user_alice/entries/entry_101`, but sets `userId: "user_bob"` inside the document payload.
```json
{
  "targetPath": "/users/user_alice/entries/entry_101",
  "auth": { "uid": "user_alice", "token": { "email_verified": true } },
  "payload": {
    "id": "entry_101",
    "userId": "user_bob",
    "title": "Falsified Author",
    "content": "Attempting to spoof author UID",
    "createdAt": 1725450000000,
    "updatedAt": 1725450000000
  }
}
```
**Expected Outcome**: `PERMISSION_DENIED` (`incoming().userId != request.auth.uid`).

### Attack 3: Resource Exhaustion / Denial-of-Wallet (Buffer Overrun)
Attacker pushes a massive 150KB string into the `title` field to exhaust bandwidth and storage quotas.
```json
{
  "targetPath": "/users/user_alice/tasks/task_huge",
  "auth": { "uid": "user_alice", "token": { "email_verified": true } },
  "payload": {
    "id": "task_huge",
    "userId": "user_alice",
    "title": "A".repeat(150000),
    "createdAt": 1725450000000
  }
}
```
**Expected Outcome**: `PERMISSION_DENIED` (`incoming().title.size() <= 256` violation).

### Attack 4: Path Variable Poisoning (Directory Traversal / Injected Delimiters)
Attacker uses a 500-character malicious path ID with forbidden symbols to corrupt indexing.
```json
{
  "targetPath": "/users/user_alice/entries/malicious%2F..%2F..%2Fetc%2Fpasswd",
  "auth": { "uid": "user_alice", "token": { "email_verified": true } },
  "payload": {
    "id": "malicious%2F..%2F..%2Fetc%2Fpasswd",
    "userId": "user_alice",
    "title": "Exploit Path",
    "createdAt": 1725450000000,
    "updatedAt": 1725450000000
  }
}
```
**Expected Outcome**: `PERMISSION_DENIED` (`isValidId(entryId)` failure).

### Attack 5: Shadow Field Injection (Privilege Escalation)
Attacker attempts a patch update to a task item injecting unapproved administrative flag `isAdmin: true` and `elevatedRole: "superadmin"`.
```json
{
  "targetPath": "/users/user_alice/tasks/task_001",
  "auth": { "uid": "user_alice", "token": { "email_verified": true } },
  "operation": "update",
  "payload": {
    "title": "Regular Task Update",
    "isAdmin": true,
    "elevatedRole": "superadmin"
  }
}
```
**Expected Outcome**: `PERMISSION_DENIED` (`affectedKeys().hasOnly(...)` gate rejects extraneous keys).

### Attack 6: Immutable Field Mutation (Rewriting Created Timestamp & ID)
Attacker attempts to backdate a daily plan and change its primary key.
```json
{
  "targetPath": "/users/user_alice/plans/plan_001",
  "auth": { "uid": "user_alice", "token": { "email_verified": true } },
  "operation": "update",
  "payload": {
    "id": "plan_forged_id",
    "createdAt": 1000000000,
    "dateStr": "2026-09-04"
  }
}
```
**Expected Outcome**: `PERMISSION_DENIED` (`incoming().id == existing().id && incoming().createdAt == existing().createdAt` fails).

### Attack 7: Array Inflation Attack (Unbounded Memory Bomb)
Attacker attempts to save an array of 5,000 subtask objects to consume memory during client-side snapshot renders.
```json
{
  "targetPath": "/users/user_alice/tasks/task_array_bomb",
  "auth": { "uid": "user_alice", "token": { "email_verified": true } },
  "payload": {
    "id": "task_array_bomb",
    "userId": "user_alice",
    "title": "Subtask Flood",
    "createdAt": 1725450000000,
    "subtasks": Array(5000).fill({ "id": "sub", "title": "flood", "completed": false })
  }
}
```
**Expected Outcome**: `PERMISSION_DENIED` (`incoming().subtasks.size() <= 50` failure).

### Attack 8: Unverified Email Write Attempt
Attacker logs in via an unverified account (`email_verified: false`) and attempts to write personal records.
```json
{
  "targetPath": "/users/unverified_user/entries/entry_test",
  "auth": { "uid": "unverified_user", "token": { "email_verified": false } },
  "payload": {
    "id": "entry_test",
    "userId": "unverified_user",
    "title": "Unverified Test",
    "createdAt": 1725450000000,
    "updatedAt": 1725450000000
  }
}
```
**Expected Outcome**: `PERMISSION_DENIED` (`request.auth.token.email_verified == true` mandate).

### Attack 9: Malformed Enum & Out-of-Range Value Attack
Attacker injects an invalid priority (`priority: "super_extreme_urgent"`) and negative focus duration (`durationMinutes: -120`).
```json
{
  "targetPath": "/users/user_alice/focusSessions/session_bad_val",
  "auth": { "uid": "user_alice", "token": { "email_verified": true } },
  "payload": {
    "id": "session_bad_val",
    "userId": "user_alice",
    "durationMinutes": -120,
    "completedAt": 1725450000000
  }
}
```
**Expected Outcome**: `PERMISSION_DENIED` (`durationMinutes >= 1 && durationMinutes <= 720` check fails).

### Attack 10: Unauthorized Data Peeking (Query/List Scraping of Another User)
Attacker `user_bob` issues a Firestore collection query for `/users/user_alice/entries`.
```json
{
  "targetPath": "/users/user_alice/entries",
  "auth": { "uid": "user_bob", "token": { "email_verified": true } },
  "operation": "list"
}
```
**Expected Outcome**: `PERMISSION_DENIED` (`request.auth.uid == userId` strictly halts the list traversal).

### Attack 11: Notification Spoofing / Unlinked Alert Injection
Attacker crafts an alert with an invalid future timestamp and unlinked context.
```json
{
  "targetPath": "/users/user_alice/notifications/notif_spoof",
  "auth": { "uid": "user_alice", "token": { "email_verified": true } },
  "payload": {
    "id": "notif_spoof",
    "userId": "user_alice",
    "title": "Phishing Alert",
    "scheduledAt": -9999,
    "priority": "invalid_urgency",
    "status": "pending",
    "createdAt": 1725450000000
  }
}
```
**Expected Outcome**: `PERMISSION_DENIED` (invalid priority and invalid timestamp).

### Attack 12: Memory Embedding Dimension Poisoning
Attacker pushes a corrupted embedding list of 10,000 float numbers into `/users/user_alice/memories/mem_01` to hijack vector computations.
```json
{
  "targetPath": "/users/user_alice/memories/mem_01",
  "auth": { "uid": "user_alice", "token": { "email_verified": true } },
  "payload": {
    "id": "mem_01",
    "userId": "user_alice",
    "entryId": "entry_01",
    "title": "Memory Dimension Bomb",
    "content": "Valid text",
    "embedding": Array(10000).fill(0.01),
    "createdAt": 1725450000000
  }
}
```
**Expected Outcome**: `PERMISSION_DENIED` (`incoming().embedding.size() <= 1536` check fails).

---

## 4. Test Harness Structure (`firestore.rules.test.ts`)

```typescript
import { describe, it, beforeAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'remixo-gemini-companion',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Cloud Firestore Fortress Security Rules Audit', () => {
  it('Attack 1: Rejects cross-user write attempt', async () => {
    const bobDb = testEnv.authenticatedContext('user_bob', { email_verified: true }).firestore();
    const docRef = bobDb.doc('users/user_alice/entries/entry_999');
    await assertFails(docRef.set({
      id: 'entry_999',
      userId: 'user_bob',
      title: 'Malicious Probe',
      content: 'Infiltrating Alice',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  });

  it('Attack 2: Rejects author UID masquerading within user collection', async () => {
    const aliceDb = testEnv.authenticatedContext('user_alice', { email_verified: true }).firestore();
    const docRef = aliceDb.doc('users/user_alice/entries/entry_101');
    await assertFails(docRef.set({
      id: 'entry_101',
      userId: 'user_bob',
      title: 'Spoofed User',
      content: 'Falsified author UID',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  });

  it('Attack 3: Rejects oversized title injection (> 256 chars)', async () => {
    const aliceDb = testEnv.authenticatedContext('user_alice', { email_verified: true }).firestore();
    const docRef = aliceDb.doc('users/user_alice/tasks/task_huge');
    await assertFails(docRef.set({
      id: 'task_huge',
      userId: 'user_alice',
      title: 'A'.repeat(500),
      createdAt: Date.now(),
    }));
  });

  it('Attack 4: Rejects path variable poisoning in document ID', async () => {
    const aliceDb = testEnv.authenticatedContext('user_alice', { email_verified: true }).firestore();
    const docRef = aliceDb.doc('users/user_alice/entries/invalid$$id!!');
    await assertFails(docRef.set({
      id: 'invalid$$id!!',
      userId: 'user_alice',
      title: 'Valid Title',
      content: 'Content',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  });

  it('Attack 5: Rejects ghost/shadow field privilege escalation', async () => {
    const aliceDb = testEnv.authenticatedContext('user_alice', { email_verified: true }).firestore();
    const docRef = aliceDb.doc('users/user_alice/tasks/task_001');
    await assertSucceeds(docRef.set({
      id: 'task_001',
      userId: 'user_alice',
      title: 'Initial Task',
      createdAt: Date.now(),
    }));
    await assertFails(docRef.update({
      title: 'Updated Title',
      isAdmin: true,
      elevatedRole: 'superadmin',
    }));
  });

  it('Attack 6: Rejects mutation of immutable createdAt and id', async () => {
    const aliceDb = testEnv.authenticatedContext('user_alice', { email_verified: true }).firestore();
    const docRef = aliceDb.doc('users/user_alice/plans/plan_001');
    const createdTime = Date.now();
    await assertSucceeds(docRef.set({
      id: 'plan_001',
      userId: 'user_alice',
      dateStr: '2026-09-04',
      createdAt: createdTime,
      updatedAt: createdTime,
    }));
    await assertFails(docRef.update({
      id: 'forged_id',
      createdAt: 1000,
      updatedAt: Date.now(),
    }));
  });

  it('Attack 7: Rejects oversized subtasks array (> 50 items)', async () => {
    const aliceDb = testEnv.authenticatedContext('user_alice', { email_verified: true }).firestore();
    const docRef = aliceDb.doc('users/user_alice/tasks/task_flood');
    await assertFails(docRef.set({
      id: 'task_flood',
      userId: 'user_alice',
      title: 'Array Bomb',
      createdAt: Date.now(),
      subtasks: Array(60).fill({ id: 's', title: 't', completed: false }),
    }));
  });

  it('Attack 8: Rejects unverified email writes', async () => {
    const unverifiedDb = testEnv.authenticatedContext('user_unverified', { email_verified: false }).firestore();
    const docRef = unverifiedDb.doc('users/user_unverified/entries/entry_unverified');
    await assertFails(docRef.set({
      id: 'entry_unverified',
      userId: 'user_unverified',
      title: 'Unverified Attempt',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  });

  it('Attack 9: Rejects invalid negative duration in focusSession', async () => {
    const aliceDb = testEnv.authenticatedContext('user_alice', { email_verified: true }).firestore();
    const docRef = aliceDb.doc('users/user_alice/focusSessions/session_negative');
    await assertFails(docRef.set({
      id: 'session_negative',
      userId: 'user_alice',
      durationMinutes: -25,
      completedAt: Date.now(),
    }));
  });

  it('Attack 10: Rejects cross-user collection list query', async () => {
    const bobDb = testEnv.authenticatedContext('user_bob', { email_verified: true }).firestore();
    const colRef = bobDb.collection('users/user_alice/entries');
    await assertFails(colRef.get());
  });

  it('Attack 11: Rejects malformed priority and negative timestamp in notification', async () => {
    const aliceDb = testEnv.authenticatedContext('user_alice', { email_verified: true }).firestore();
    const docRef = aliceDb.doc('users/user_alice/notifications/notif_bad');
    await assertFails(docRef.set({
      id: 'notif_bad',
      userId: 'user_alice',
      title: 'Bad Alert',
      scheduledAt: -100,
      priority: 'hacked_priority',
      status: 'pending',
      createdAt: Date.now(),
    }));
  });

  it('Attack 12: Rejects memory embedding dimension overflow (> 1536)', async () => {
    const aliceDb = testEnv.authenticatedContext('user_alice', { email_verified: true }).firestore();
    const docRef = aliceDb.doc('users/user_alice/memories/mem_bomb');
    await assertFails(docRef.set({
      id: 'mem_bomb',
      userId: 'user_alice',
      entryId: 'entry_01',
      title: 'Dimension Flood',
      content: 'Sample text',
      embedding: Array(2000).fill(0.1),
      createdAt: Date.now(),
    }));
  });

  it('Happy Path: Allows compliant document creation and read for authorized user', async () => {
    const aliceDb = testEnv.authenticatedContext('user_alice', { email_verified: true }).firestore();
    const docRef = aliceDb.doc('users/user_alice/entries/entry_valid');
    const now = Date.now();
    await assertSucceeds(docRef.set({
      id: 'entry_valid',
      userId: 'user_alice',
      title: 'My Peaceful Morning',
      content: 'Reflecting on growth and mindfulness.',
      mood: 'calm',
      tags: ['morning', 'peace'],
      createdAt: now,
      updatedAt: now,
    }));
    await assertSucceeds(docRef.get());
  });
});
```
