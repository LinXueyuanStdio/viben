---
sidebar_position: 5
title: Admin UI
description: 管理后台：包审核、内容审核、平台管理
---

# Admin UI 模块

> 管理后台，用于包审核、内容审核和平台管理。

---

## Overview

The admin UI provides platform administrators with tools to moderate content, manage packages, and handle user reports. It is integrated into the existing `apps/web` as a protected route group.

---

## Architecture Decisions

### Route Group vs Separate App

**Decision**: Route group `/admin/*` within `apps/web`

**Rationale**:
- Shares existing components, design system, and auth infrastructure
- Simpler deployment (single app)
- Easier to maintain consistent UX
- Admin-only routes protected by middleware

### Role-Based Access Control (RBAC)

**Decision**: Multiple admin roles with granular permissions

| Role | Level | Permissions |
|------|-------|-------------|
| `super_admin` | 100 | Full access - all features + admin management |
| `moderator` | 50 | Package review, content moderation, user warnings |
| `support` | 25 | Read-only access, handle user reports, escalate issues |

**Permission Model**:
```typescript
type AdminPermission =
  | 'admin.access'           // Can access /admin routes
  | 'packages.review'        // Review pending packages
  | 'packages.approve'       // Approve/reject packages
  | 'packages.feature'       // Feature/unfeature packages
  | 'content.moderate'       // Moderate comments/collections
  | 'content.delete'         // Delete content
  | 'users.view'             // View user details
  | 'users.warn'             // Send warnings to users
  | 'users.ban'              // Ban/unban users
  | 'reports.view'           // View reports
  | 'reports.resolve'        // Resolve reports
  | 'admin.manage';          // Manage other admins
```

**Role Permissions Matrix**:

| Permission | support | moderator | super_admin |
|------------|---------|-----------|-------------|
| admin.access | ✅ | ✅ | ✅ |
| packages.review | ❌ | ✅ | ✅ |
| packages.approve | ❌ | ✅ | ✅ |
| packages.feature | ❌ | ✅ | ✅ |
| content.moderate | ❌ | ✅ | ✅ |
| content.delete | ❌ | ✅ | ✅ |
| users.view | ✅ | ✅ | ✅ |
| users.warn | ❌ | ✅ | ✅ |
| users.ban | ❌ | ❌ | ✅ |
| reports.view | ✅ | ✅ | ✅ |
| reports.resolve | ✅ | ✅ | ✅ |
| admin.manage | ❌ | ❌ | ✅ |

---

## Routes

### Route Structure

```
/admin                        # Dashboard overview
├── /admin/packages           # Package moderation hub
│   ├── /admin/packages/mcp   # MCP packages queue
│   └── /admin/packages/skills # Skills queue
├── /admin/content            # Content moderation hub
│   ├── /admin/content/comments    # Comment moderation
│   └── /admin/content/collections # Collection moderation
├── /admin/reports            # User reports inbox
├── /admin/users              # User management (Phase 2)
└── /admin/settings           # Admin settings (Phase 2)
```

### Route Files

```
apps/web/app/(admin)/
├── layout.tsx                # Admin layout with sidebar
├── page.tsx                  # /admin - Dashboard
├── packages/
│   ├── page.tsx              # /admin/packages - Overview
│   ├── mcp/
│   │   └── page.tsx          # MCP queue
│   └── skills/
│       └── page.tsx          # Skills queue
├── content/
│   ├── page.tsx              # /admin/content - Overview
│   ├── comments/
│   │   └── page.tsx          # Comment moderation
│   └── collections/
│       └── page.tsx          # Collection moderation
└── reports/
    └── page.tsx              # Reports inbox
```

---

## Database Schema Changes

### 1. Expand User Roles

Update the `users` table role enum:

```typescript
// Current
role: text('role').default('user'), // 'user' | 'developer' | 'admin'

// Updated
role: text('role').default('user'),
// 'user' | 'developer' | 'admin' | 'super_admin' | 'moderator' | 'support'
```

**Migration Note**: Existing `admin` users should be migrated to `super_admin`.

### 2. Package Status

Add status field to packages:

```typescript
// mcpPackages and skillPackages
status: text('status').default('pending'),
// 'pending' | 'approved' | 'rejected' | 'featured'

featuredAt: timestamp('featured_at'),
featuredBy: text('featured_by').references(() => users.id),
reviewedAt: timestamp('reviewed_at'),
reviewedBy: text('reviewed_by').references(() => users.id),
rejectionReason: text('rejection_reason'),
```

### 3. Reports Table (New)

```typescript
export const reports = pgTable('reports', {
  id: text('id').primaryKey().$defaultFn(() => createId()),

  // What is being reported
  entityType: text('entity_type').notNull(), // 'mcp' | 'skill' | 'comment' | 'collection' | 'user'
  entityId: text('entity_id').notNull(),

  // Who reported
  reporterId: text('reporter_id').notNull().references(() => users.id),

  // Report details
  reason: text('reason').notNull(), // 'spam' | 'inappropriate' | 'copyright' | 'security' | 'other'
  description: text('description'),

  // Resolution
  status: text('status').default('pending'), // 'pending' | 'resolved' | 'dismissed'
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by').references(() => users.id),
  resolution: text('resolution'), // Admin notes

  createdAt: timestamp('created_at').defaultNow(),
});
```

### 4. Moderation Logs Table (New)

```typescript
export const moderationLogs = pgTable('moderation_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),

  // Who performed the action
  adminId: text('admin_id').notNull().references(() => users.id),

  // What was affected
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),

  // Action details
  action: text('action').notNull(),
  // 'approve' | 'reject' | 'feature' | 'unfeature' | 'delete' | 'warn' | 'ban' | 'unban'

  reason: text('reason'),
  metadata: jsonb('metadata'), // Additional context

  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## API Endpoints

### Admin Access Middleware

```typescript
// middleware/admin.ts
export async function requireAdmin(req: Request, minLevel: number = 25) {
  const user = await getCurrentUser(req);

  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }

  const roleLevel = ROLE_LEVELS[user.role] ?? 0;
  if (roleLevel < minLevel) {
    throw new ForbiddenError('Insufficient permissions');
  }

  return user;
}

const ROLE_LEVELS = {
  user: 0,
  developer: 0,
  support: 25,
  moderator: 50,
  admin: 100,      // Legacy, treat as super_admin
  super_admin: 100,
};
```

### Package Moderation API

```
GET    /api/admin/packages              # List packages (filterable by status)
GET    /api/admin/packages/[id]         # Get package details with history
POST   /api/admin/packages/[id]/approve # Approve package
POST   /api/admin/packages/[id]/reject  # Reject package (with reason)
POST   /api/admin/packages/[id]/feature # Toggle featured status
```

### Content Moderation API

```
GET    /api/admin/comments              # List comments (filterable)
DELETE /api/admin/comments/[id]         # Delete comment
GET    /api/admin/collections           # List collections (filterable)
PATCH  /api/admin/collections/[id]      # Update collection (hide, etc.)
DELETE /api/admin/collections/[id]      # Delete collection
```

### Reports API

```
GET    /api/admin/reports               # List reports (filterable by status)
GET    /api/admin/reports/[id]          # Get report details
POST   /api/admin/reports/[id]/resolve  # Resolve report
POST   /api/admin/reports/[id]/dismiss  # Dismiss report
```

### Moderation Logs API

```
GET    /api/admin/logs                  # List moderation logs (filterable)
```

---

## UI Components

### Admin Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header (same as dashboard)                           🔔 👤  │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Sidebar     │  Main Content                                │
│              │                                              │
│  Dashboard   │  ┌────────────────────────────────────────┐  │
│              │  │ Stats Cards                            │  │
│  ── Admin ── │  │ [Pending] [Reports] [Today's Actions] │  │
│  📦 Packages │  └────────────────────────────────────────┘  │
│    └ MCP     │                                              │
│    └ Skills  │  ┌────────────────────────────────────────┐  │
│  💬 Content  │  │ Recent Activity / Queue Preview        │  │
│    └ Comments│  │                                        │  │
│    └ Collec. │  │                                        │  │
│  📋 Reports  │  └────────────────────────────────────────┘  │
│              │                                              │
│  ── User ──  │                                              │
│  (normal nav)│                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### Admin Sidebar Extension

The sidebar should conditionally show admin section:

```tsx
// components/layout/sidebar.tsx
{user.role in ['admin', 'super_admin', 'moderator', 'support'] && (
  <SidebarGroup>
    <SidebarGroupLabel>Admin</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/admin">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {hasPermission('packages.review') && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/admin/packages">
                <Package className="h-4 w-4" />
                Packages
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {pendingCount}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
        {/* ... more items */}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
)}
```

### Package Review Card

```tsx
interface PackageReviewCardProps {
  package: McpPackage | SkillPackage;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onFeature: () => void;
}

// Visual structure:
┌────────────────────────────────────────────────────┐
│ [MCP Badge]                          Submitted 2h ago │
│                                                    │
│ Package Name                                v1.0.0 │
│ by @username                                       │
│                                                    │
│ Description text here...                           │
│                                                    │
│ Tags: [tag1] [tag2] [tag3]                        │
│                                                    │
│ ───────────────────────────────────────────────── │
│ [View Details]  [Reject ▾]           [✓ Approve]  │
└────────────────────────────────────────────────────┘
```

### Report Card

```tsx
interface ReportCardProps {
  report: Report;
  onResolve: (resolution: string) => void;
  onDismiss: () => void;
}

// Visual structure:
┌────────────────────────────────────────────────────┐
│ 🚩 [Spam] Report                      2 hours ago │
│                                                    │
│ Reported: Comment on "mcp-package-name"           │
│ Reporter: @username                                │
│                                                    │
│ "This comment contains spam links..."              │
│                                                    │
│ ───────────────────────────────────────────────── │
│ [View Content]  [Dismiss]           [Resolve ▾]   │
└────────────────────────────────────────────────────┘
```

### Moderation Action Modal

```tsx
interface ModerationActionModalProps {
  action: 'reject' | 'delete' | 'warn' | 'ban';
  entityType: string;
  entityId: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}
```

---

## Component Hierarchy

```
components/admin/
├── layout/
│   ├── admin-sidebar.tsx      # Admin navigation section
│   └── admin-header.tsx       # Optional: admin-specific header elements
├── dashboard/
│   ├── stats-cards.tsx        # Pending, reports, actions stats
│   ├── recent-activity.tsx    # Recent moderation actions
│   └── queue-preview.tsx      # Quick look at pending items
├── packages/
│   ├── package-review-card.tsx
│   ├── package-review-list.tsx
│   ├── package-filters.tsx
│   └── rejection-modal.tsx
├── content/
│   ├── comment-review-card.tsx
│   ├── comment-review-list.tsx
│   ├── collection-review-card.tsx
│   └── delete-modal.tsx
├── reports/
│   ├── report-card.tsx
│   ├── report-list.tsx
│   ├── report-filters.tsx
│   └── resolve-modal.tsx
└── shared/
    ├── moderation-badge.tsx   # Status badges
    ├── action-log.tsx         # Display action history
    └── confirm-modal.tsx      # Generic confirmation
```

---

## State Management

### Server State (Recommended)

Use React Server Components where possible:

```tsx
// app/(admin)/packages/page.tsx
export default async function PackagesPage({
  searchParams,
}: {
  searchParams: { status?: string; type?: string };
}) {
  const packages = await getPackagesForReview({
    status: searchParams.status ?? 'pending',
    type: searchParams.type,
  });

  return (
    <PackageReviewList packages={packages} />
  );
}
```

### Client State

For interactive features, use URL search params + React state:

```tsx
// Filters in URL for shareability
const [searchParams, setSearchParams] = useSearchParams();

// Local UI state only
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const [isModalOpen, setIsModalOpen] = useState(false);
```

---

## Implementation Phases

### Phase 1: Foundation (Current)

- [ ] Database schema changes (roles, status, reports, logs)
- [ ] Admin middleware and permission helpers
- [ ] Admin sidebar extension
- [ ] `/admin` dashboard with stats

### Phase 2: Package Moderation

- [ ] `/admin/packages` listing with filters
- [ ] Package review cards
- [ ] Approve/reject/feature actions
- [ ] Rejection modal with reason

### Phase 3: Content Moderation

- [ ] `/admin/content/comments` listing
- [ ] Comment moderation actions
- [ ] `/admin/content/collections` listing
- [ ] Collection moderation actions

### Phase 4: Reports System

- [ ] Report submission UI (user-facing)
- [ ] `/admin/reports` inbox
- [ ] Report resolution workflow

### Phase 5: Enhancements (Future)

- [ ] User management (`/admin/users`)
- [ ] Bulk actions
- [ ] Advanced analytics
- [ ] Webhook notifications

---

## Design Guidelines

### Colors

Use existing design system colors with semantic meaning:

| Status | Color | Usage |
|--------|-------|-------|
| Pending | `amber` (primary) | Items awaiting review |
| Approved | `green` | Approved items |
| Rejected | `red` (destructive) | Rejected items |
| Featured | `primary` with star | Featured items |

### Typography

- Page titles: `font-serif text-2xl font-bold`
- Section headers: `font-sans text-lg font-semibold`
- Card titles: `font-sans text-base font-medium`
- Metadata: `text-sm text-muted-foreground`

### Motion

- Cards should animate in with stagger
- Action buttons should have hover states
- Modals should fade in
- Status changes should animate (color transitions)

---

## Security Considerations

1. **Route Protection**: All `/admin/*` routes protected by middleware
2. **API Protection**: All `/api/admin/*` endpoints verify admin role
3. **Audit Trail**: All moderation actions logged
4. **Rate Limiting**: Prevent abuse of moderation actions
5. **CSRF Protection**: All mutations use POST with CSRF tokens

---

## Related Specs

| Spec | Relevance |
|------|-----------|
| [Design System](../frontend/design-system.md) | UI patterns, colors, typography |
| [Components](../frontend/components.md) | Component conventions |
| [Auth Module](./auth.md) | Authentication infrastructure |
| [Database](./database.md) | Schema conventions |
| [MCP API](./mcp-api.md) | Package data structure |
| [Skills API](./skills-api.md) | Skills data structure |
| [Social API](./social-api.md) | Comments, ratings structure |
