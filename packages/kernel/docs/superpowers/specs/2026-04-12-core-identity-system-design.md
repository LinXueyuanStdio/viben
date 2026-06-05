# Core Identity System — Design Spec

**Date:** 2026-04-12
**Status:** Draft
**Depends on:** None (foundation for other specs)

---

## Overview

Viben currently has no identity system. `userId` is a transient string in message payloads — not persisted, not queryable, not linked across platforms. Each adapter and plugin must independently track "who is this person," leading to fragmented, inconsistent user management.

This spec introduces a built-in identity plugin (`@viben/identity`) that provides a unified User + Identity model, cross-platform linking, role-based access, and a plugin API surface that all other plugins can consume.

---

## Goals

- Single source of truth for user identity across all adapters and plugins
- Cross-platform identity linking (Telegram user = App user = Discord user)
- Role-based access control replacing the current flat allowlist
- Auto-registration on first message (adapter users) and explicit setup flow (API/App users)
- Plugin-friendly API: any plugin can look up users, resolve mentions, check roles
- Abstract storage layer for future migration (kv.json → SQLite)

**Non-goals (v1):**
- Fine-grained per-resource permissions (e.g., "user X can only access session Y")
- OAuth2/OIDC federation with external identity providers
- User groups or teams (workspace plugin handles this per-session)

---

## Part 1 — Data Model

### 1.1 UserRecord (cross-platform, agent-facing)

Represents a person. One person can have multiple platform identities.

```typescript
interface UserRecord {
  userId: string               // 'u_' + nanoid(12), stable primary key
  displayName: string          // Human-readable name
  username?: string            // Canonical, unique, used for @mention resolution
  avatarUrl?: string
  role: UserRole               // 'admin' | 'member' | 'viewer' | 'blocked'
  timezone?: string            // IANA timezone (e.g. 'Asia/Saigon')
  locale?: string              // BCP 47 locale (e.g. 'vi-VN')
  identities: IdentityId[]    // All linked identities
  pluginData: Record<string, Record<string, unknown>>  // Namespaced by plugin name
  createdAt: string            // ISO 8601
  updatedAt: string
  lastSeenAt: string
}

type UserRole = 'admin' | 'member' | 'viewer' | 'blocked'
```

### 1.2 IdentityRecord (platform-specific, adapter-facing)

Represents a single platform account. Multiple IdentityRecords can belong to one UserRecord.

```typescript
interface IdentityRecord {
  identityId: IdentityId       // '{source}:{platformId}' e.g. 'telegram:123456789'
  userId: string               // → UserRecord.userId
  source: string               // 'telegram' | 'discord' | 'slack' | 'api'
  platformId: string           // Platform-specific user ID
  platformUsername?: string    // Platform-native username (adapter-facing)
  platformDisplayName?: string // Platform-native display name
  createdAt: string
  updatedAt: string
}

// IdentityId is a branded string type: '{source}:{platformId}'
type IdentityId = string & { readonly __brand: 'IdentityId' }
```

### 1.3 Core fields vs pluginData

Common fields (`displayName`, `username`, `avatarUrl`, `timezone`, `locale`, `role`) are typed on UserRecord — validated by core, accessible without namespace.

Plugin-specific data lives in `pluginData`, namespaced by plugin name:
```typescript
pluginData: {
  '@viben/workspace': { lastTeamSession: 'sess_abc' },
  '@viben/billing': { budget: 100, plan: 'pro' }
}
```

This prevents collision between plugins and enables clean uninstall cleanup (`delete pluginData[pluginName]`).

### 1.4 Storage layout (KvIdentityStore)

```
users/{userId}                      → UserRecord
identities/{source}:{platformId}    → IdentityRecord
idx/usernames/{username}            → userId
idx/sources/{source}/{platformId}   → identityId
```

Backed by `PluginStorage` (kv.json) with an abstract `IdentityStore` interface to allow future migration to SQLite.

```typescript
interface IdentityStore {
  // Users
  getUser(userId: string): Promise<UserRecord | undefined>
  putUser(record: UserRecord): Promise<void>
  deleteUser(userId: string): Promise<void>
  listUsers(filter?: { source?: string; role?: UserRole }): Promise<UserRecord[]>

  // Identities
  getIdentity(identityId: IdentityId): Promise<IdentityRecord | undefined>
  putIdentity(record: IdentityRecord): Promise<void>
  deleteIdentity(identityId: IdentityId): Promise<void>
  getIdentitiesForUser(userId: string): Promise<IdentityRecord[]>

  // Indexes
  getUserIdByUsername(username: string): Promise<string | undefined>
  getIdentityIdBySource(source: string, platformId: string): Promise<IdentityId | undefined>

  // Index maintenance
  setUsernameIndex(username: string, userId: string): Promise<void>
  deleteUsernameIndex(username: string): Promise<void>
  setSourceIndex(source: string, platformId: string, identityId: IdentityId): Promise<void>
  deleteSourceIndex(source: string, platformId: string): Promise<void>
}
```

---

## Part 2 — Identity Service API

Registered as service `identity`. Plugins access via `ctx.getService<IdentityService>('identity')`, consistent with the established pattern for all services in Viben (no direct properties on PluginContext).

```typescript
interface IdentityService {
  // === Read (requires 'identity:read') ===

  getUser(userId: string): Promise<UserRecord | undefined>
  getUserByUsername(username: string): Promise<UserRecord | undefined>
  getIdentity(identityId: IdentityId): Promise<IdentityRecord | undefined>
  getUserByIdentity(identityId: IdentityId): Promise<UserRecord | undefined>
  getIdentitiesFor(userId: string): Promise<IdentityRecord[]>
  listUsers(filter?: { source?: string; role?: UserRole }): Promise<UserRecord[]>
  searchUsers(query: string): Promise<UserRecord[]>
  getSessionsFor(userId: string): Promise<SessionInfo[]>

  // === Write (requires 'identity:write') ===

  upsertUser(data: { displayName: string; username?: string; role?: UserRole }): Promise<UserRecord>
  updateUser(userId: string, changes: Partial<Pick<UserRecord, 'displayName' | 'username' | 'avatarUrl' | 'timezone' | 'locale'>>): Promise<UserRecord>
  setRole(userId: string, role: UserRole): Promise<void>
  createIdentity(userId: string, identity: { source: string; platformId: string; platformUsername?: string }): Promise<IdentityRecord>
  link(identityIdA: IdentityId, identityIdB: IdentityId): Promise<void>
  unlink(identityId: IdentityId): Promise<void>
  setPluginData(userId: string, pluginName: string, key: string, value: unknown): Promise<void>
  getPluginData(userId: string, pluginName: string, key: string): Promise<unknown>

  // === Source registration (requires 'identity:register-source') ===

  registerSource(source: string): void

  // === Helpers (requires 'identity:read') ===

  resolveCanonicalMention(username: string, source: string): Promise<{
    found: boolean
    platformId?: string
    platformUsername?: string
  } | undefined>
}
```

### 2.1 Permissions

| Permission | Allows |
|---|---|
| `identity:read` | Lookup, query, search users and identities |
| `identity:write` | Create, update, link/unlink, set roles |
| `identity:register-source` | Register identity source (adapters) |

### 2.2 Plugin access pattern

```typescript
// In any plugin's setup():
const identity = ctx.getService<IdentityService>('identity')
if (identity) {
  const user = await identity.getUserByUsername('lucas')
}
```

No direct property on PluginContext — follows the same `ctx.getService()` pattern used by all other services (security, file-service, notifications, etc.).

---

## Part 3 — Auto-registration & Session Integration

### 3.1 Auto-registration middleware

Built-in middleware on `message:incoming`, priority 110 (runs AFTER security plugin at default priority 100).

**Why after security?** Security must reject blocked/unauthorized users first. Auto-registration should not create user records for requests that will be rejected. For the first message from a new user (not yet in identity system), security falls through to its existing allowlist or allows by default — identity registration happens after that check passes.

```
message:incoming { channelId, userId, meta.channelUser? }
  ↓
  identityId = formatIdentityId(channelId, userId)   // → '{channelId}:{userId}'
  ↓
  identity = store.getIdentity(identityId)
  ↓
  ├─ NOT FOUND (first message from this platform account):
  │   → Create UserRecord:
  │       userId = 'u_' + nanoid(12)
  │       displayName = meta.channelUser?.displayName ?? userId
  │       username = meta.channelUser?.username ?? null (first come from platform)
  │       role = config.defaultRole (default: 'member')
  │   → Create IdentityRecord:
  │       identityId, userId, source = channelId, platformId = userId
  │       platformUsername = meta.channelUser?.username
  │       platformDisplayName = meta.channelUser?.displayName
  │   → First user ever registered → role = 'admin' (auto-promote)
  │   → Set username + source indexes
  │   → Emit 'identity:created' event
  │
  └─ FOUND:
      → Update lastSeenAt on UserRecord
      → Sync platformDisplayName/platformUsername if changed from adapter
  ↓
  Inject into TurnMeta:
    meta.identity = {
      userId: 'u_abc123',
      identityId: 'telegram:123',
      displayName: 'Lucas',
      username: 'lucas',
      role: 'admin'
    }
  ↓
  All subsequent hooks (agent:beforePrompt, turn:start, etc.) have meta.identity
```

### 3.2 API/App users — setup flow

API users (App, remote clients) go through a separate setup flow after token exchange:

```
POST /auth/exchange { code }
  → JWT { sub: 'tok_xxx' } (unchanged, no identity side-effects)

POST /identity/setup
Authorization: Bearer <token>
Body: { displayName: 'Lucas', username?: 'lucas' }
  → Create UserRecord + IdentityRecord 'api:{tokenId}'
  → Store userId on token record (TokenStore)
  → Return { userId, displayName, username }

POST /identity/setup
Authorization: Bearer <token>
Body: { linkCode: 'abc123' }
  → Validate linkCode (one-time, 5 min TTL)
  → Create IdentityRecord 'api:{tokenId}' → attach to existing UserRecord
  → Store userId on token record
  → Return { userId, displayName, username }
```

**Token → User mapping:**
- TokenStore gets a new optional `userId?: string` field on `StoredToken` — backward compatible since existing tokens in `tokens.json` simply won't have it (TypeScript optional field, JSON missing key = undefined)
- No migration needed — existing tokens work as before; `userId` is populated when user calls `/identity/setup`
- Identity middleware on API requests: `request.auth.tokenId` → `tokenStore.get(tokenId).userId` → `UserRecord`
- Token with no userId → `request.identity = null` → App must call `/identity/setup`

**Link code flow (multi-device / token expiry recovery):**
```
POST /identity/link-code
Authorization: Bearer <token> (must have userId)
  → Generate one-time code, 5 min TTL
  → { linkCode, expiresAt }

New device → exchange → /identity/setup { linkCode }
  → Attach new token to existing user
```

### 3.3 Session integration

**SessionRecord additions:**
```typescript
interface SessionRecord {
  // ... existing fields
  createdBy?: string        // userId of session creator
  participants?: string[]   // userId[] of all users who sent messages
}
```

**Fixing `session:beforeCreate` userId:**
Currently `session-factory.ts` hardcodes `userId: ''` in the `session:beforeCreate` payload because `SessionCreateParams` has no userId field. Fix approach:
- Add `userId?: string` to `SessionCreateParams`
- In `core.ts` `handleMessage()`, extract `meta.identity.userId` after middleware runs and pass it to `createSession()`
- `session-factory.ts` reads `params.userId ?? ''` instead of hardcoded empty string

**Fixing `session:created` event:**
Currently `session-factory.ts` emits `BusEvent.SESSION_CREATED` without `userId` — a mismatch with the plugin type definitions. Fix: include `userId` from params in the emitted event payload.

**Participant tracking:**
- Each `message:incoming` (in auto-registration middleware) adds userId to session's `participants[]` if not already present
- Requires reading session record and updating it — uses `kernel:access` permission

### 3.4 Security plugin integration

Security plugin detects identity service availability and delegates:

```
// Security plugin setup():
const identityService = ctx.getService<IdentityService>('identity')

if (identityService) {
  // Use role-based access
  checkAccess = async (userId) => {
    const identity = await identityService.getIdentity(formatIdentityId(channelId, userId))
    const user = identity ? await identityService.getUser(identity.userId) : undefined
    if (!user) return { allowed: true }  // auto-registration handles new users
    if (user.role === 'blocked') return { allowed: false, reason: 'User blocked' }
    if (user.role === 'viewer') return { allowed: false, reason: 'Read-only access' }
    return { allowed: true }
  }
} else {
  // Fallback to allowlist (current behavior)
}
```

---

## Part 4 — Linking & Role System

### 4.1 Linking flow

```
link('telegram:123', 'discord:456')
  ↓
  userA = getUserByIdentity('telegram:123')   // User u_abc
  userB = getUserByIdentity('discord:456')    // User u_def
  ↓
  ├─ Same user (userA.userId === userB.userId) → no-op
  │
  ├─ userB has no user yet → create identity, attach to userA
  │
  └─ Different users → MERGE:
      → Keep older user (lower createdAt)
      → Move all identities from younger user → older user
      → Merge pluginData: per-namespace, keep older user's data, add missing keys from younger
      → Delete younger UserRecord
      → Emit 'identity:linked' + 'identity:userMerged'
```

### 4.2 Unlinking flow

```
unlink('discord:456')
  ↓
  user = getUserByIdentity('discord:456')
  ↓
  ├─ User has only 1 identity → error: cannot unlink last identity
  └─ User has multiple identities:
      → Remove 'discord:456' from user.identities
      → Create new UserRecord for 'discord:456'
      → pluginData: not copied (fresh start)
      → Update IdentityRecord.userId to new user
      → Emit 'identity:unlinked'
```

### 4.3 Username handling

- Canonical username is agent-facing, used for @mention resolution
- Platform usernames (platformUsername on IdentityRecord) are adapter-facing
- First message auto-registration: `username = meta.channelUser.username` if available (first come first serve)
- User can change canonical username anytime via `/whoami <name>` or `PUT /identity/users/me`
- Username uniqueness enforced via `idx/usernames/` index
- On merge: keep older user's username; if older has no username, take younger's

### 4.4 Role system

```typescript
type UserRole = 'admin' | 'member' | 'viewer' | 'blocked'
```

| Role | Create session | Send message | Approve permissions | Manage users |
|---|---|---|---|---|
| admin | yes | yes | yes | yes |
| member | yes | yes | yes | no |
| viewer | no | no (read-only via App) | no | no |
| blocked | no | no | no | no |

- Default role for new users: configurable, default `'member'`
- First user ever registered: auto-promoted to `'admin'`
- Role changes via `identityService.setRole()` or `PUT /identity/users/:userId/role` (admin only)

---

## Part 5 — Lifecycle Events

The identity plugin is a built-in core plugin. Its lifecycle events are added to the core `EventBusEvents` interface (extending the typed EventBus), not emitted via `ctx.emitHook()`. This is because identity events are foundational — many plugins and core subsystems need to subscribe, and EventBus provides typed, decoupled pub/sub without requiring middleware chain registration.

**New entries in `EventBusEvents` interface (`event-bus.ts`):**

```typescript
'identity:created':     (data: { userId: string; identityId: IdentityId; source: string; displayName: string }) => void
'identity:updated':     (data: { userId: string; changes: string[] }) => void
'identity:linked':      (data: { userId: string; identityId: IdentityId; linkedFrom?: string }) => void
'identity:unlinked':    (data: { userId: string; identityId: IdentityId; newUserId: string }) => void
'identity:userMerged':  (data: { keptUserId: string; mergedUserId: string; movedIdentities: IdentityId[] }) => void
'identity:roleChanged': (data: { userId: string; oldRole: UserRole; newRole: UserRole; changedBy?: string }) => void
'identity:seen':        (data: { userId: string; identityId: IdentityId; sessionId: string }) => void  // throttled: max 1 per user per 5 min
```

**New entries in `BusEvent` enum (`events.ts`):**

```typescript
IDENTITY_CREATED     = 'identity:created'
IDENTITY_UPDATED     = 'identity:updated'
IDENTITY_LINKED      = 'identity:linked'
IDENTITY_UNLINKED    = 'identity:unlinked'
IDENTITY_USER_MERGED = 'identity:userMerged'
IDENTITY_ROLE_CHANGED = 'identity:roleChanged'
IDENTITY_SEEN        = 'identity:seen'
```

Plugins subscribe via `ctx.on(BusEvent.IDENTITY_CREATED, handler)` (requires `events:read` permission).

---

## Part 6 — REST API

All routes registered via api-server's `registerPlugin('/identity', routes, { auth: true })`.

```
# User management
GET    /identity/users                        → List users (filter: source, role, search)
GET    /identity/users/me                     → Current user (from token → userId)
PUT    /identity/users/me                     → Update own profile (displayName, username, avatarUrl, timezone, locale)
GET    /identity/users/:userId                → Get user by userId
PUT    /identity/users/:userId/role           → Set role (admin only)

# Identity management
GET    /identity/users/:userId/identities     → List all identities for user
POST   /identity/link                         → { identityIdA, identityIdB } — link two identities
POST   /identity/unlink                       → { identityId } — unlink identity into new user

# Setup (for API/App users)
POST   /identity/setup                        → { displayName, username? } or { linkCode } — first-time identity setup
POST   /identity/link-code                    → Generate one-time link code for multi-device

# Lookup
GET    /identity/resolve/:identityId          → Resolve identityId → full UserRecord + IdentityRecord
GET    /identity/search?q=lucas               → Search by displayName or username
```

**Auth:**
- All routes require JWT
- `/users/me` routes use `request.auth.tokenId` → `tokenStore.userId` → UserRecord
- `/users/:userId/role` requires `user.role === 'admin'`
- `/identity/setup` is the only route that works without userId on token (creates the association)

**GET /auth/me (updated response):**
```typescript
{
  type: 'jwt',
  tokenId: 'tok_xxx',
  role: 'operator',
  scopes: [...],
  userId: 'u_abc123' | null,     // null if not yet set up
  displayName: 'Lucas' | null,
  claimed: true | false           // App uses this to show setup UI
}
```

---

## Part 7 — Mention System (Canonical vs Platform)

### 7.1 Agent context — canonical username

Agent always sees and writes canonical usernames:
```
Agent input:  [Lucas (@lucas)]: @lucas check this
Agent output: @lucas I've updated the code
```

### 7.2 Resolution

```typescript
identityService.getUserByUsername('lucas')
  → UserRecord { userId: 'u_abc', identities: ['telegram:123', 'discord:456', 'api:u_abc'] }

identityService.getIdentitiesFor('u_abc')
  → [
      { identityId: 'telegram:123', platformUsername: 'lucas_tg', ... },
      { identityId: 'discord:456', platformUsername: 'lucasdev', ... },
      { identityId: 'api:u_abc', platformUsername: null, ... },
    ]
```

### 7.3 Delivery — adapter rewrites mentions

Each adapter registers `message:outgoing` middleware to rewrite canonical → platform-native:

```
Agent output: "@lucas I've updated the code"
  ↓
Telegram middleware: "@lucas_tg I've updated the code"
Discord middleware:  "<@456789> I've updated the code"
Slack middleware:    "<@UXXXXXX> I've updated the code"
SSE:                "@lucas I've updated the code" (kept canonical, App renders)
```

### 7.4 Helper for adapters

```typescript
identityService.resolveCanonicalMention(username: string, source: string): Promise<{
  found: boolean
  platformId?: string
  platformUsername?: string
} | undefined>
```

---

## Part 8 — Plugin Structure

```
@viben/identity (built-in core plugin)
├── src/
│   ├── index.ts                    — Plugin entry point
│   ├── identity-service.ts         — IdentityService implementation
│   ├── store/
│   │   ├── identity-store.ts       — Abstract IdentityStore interface
│   │   └── kv-identity-store.ts    — KvIdentityStore (PluginStorage-backed)
│   ├── middleware/
│   │   └── auto-register.ts        — message:incoming auto-registration
│   ├── routes/
│   │   ├── users.ts                — User CRUD routes
│   │   ├── identities.ts           — Identity management routes
│   │   └── setup.ts                — /identity/setup + /identity/link-code
│   └── utils/
│       ├── identity-id.ts          — parseIdentityId, formatIdentityId helpers
│       └── username.ts             — Validation, normalization
├── package.json
└── tsconfig.json
```

**Permissions declared:**
```typescript
permissions: [
  'storage:read', 'storage:write',
  'middleware:register',
  'services:register', 'services:use',
  'events:emit',
  'commands:register',
]
```

**Plugin dependencies:**
```typescript
optionalPluginDependencies: {
  '@viben/api-server': '>=0.1.0'   // REST API disabled if not available
}
```

---

## Error Handling

- Username conflict on create/update: return error with existing username info, do not block
- Identity lookup failure: log warning, continue without identity context in TurnMeta
- Storage write failure: log error, do not block message pipeline
- Link/unlink on non-existent identity: return descriptive error
- Merge conflict in pluginData: keep older user's data per namespace, skip conflicting keys
- `/identity/setup` with taken username: return 409 with suggestion to choose another
- `/identity/setup` with invalid/expired linkCode: return 401

---

## Dependencies

- `@viben/api-server` (optional — REST routes disabled if not available)
- Viben core (same repo — built-in plugin)

---

## Out of Scope (v2+)

- OAuth2/OIDC federation
- Per-resource permissions
- User groups / teams
- Profile picture upload and storage
- Username reservation / verification
- Account deletion with GDPR compliance
