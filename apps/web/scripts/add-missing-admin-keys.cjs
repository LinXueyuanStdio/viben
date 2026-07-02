/**
 * Script to add missing dashboard.admin keys to all locale files.
 * Only modifies locales that don't already have the keys.
 */

const fs = require('fs');
const path = require('path');

// New keys to add with their English fallback values
const NEW_STAT_KEYS = {
  totalPublishedPages: 'Published Pages',
  totalMoments: 'Moments',
  totalPackages: 'Total Packages',
  newUsersToday: 'New Users (Today)',
  newUsersThisWeek: 'New Users (Week)',
  totalDownloads: 'Total Downloads',
  totalComments: 'Total Comments',
};

const NEW_ACTION_KEYS = {
  hide: 'hide',
  unhide: 'unhide',
};

const NEW_ENTITY_TYPE_KEYS = {
  moment: 'Moment',
  published_page: 'Page',
};

const LOCALES_DIR = path.join(__dirname, '..', 'lib', 'i18n', 'locales');

function processFile(filePath) {
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);

  const admin = data?.dashboard?.admin;
  if (!admin) {
    console.log(`  SKIP ${fileName}: no dashboard.admin section`);
    return false;
  }

  let modified = false;

  // Add new stat keys after totalUsers (before recentModeration)
  for (const [key, value] of Object.entries(NEW_STAT_KEYS)) {
    if (!(key in admin)) {
      // Insert before recentModeration key
      // We do this by rebuilding the object with keys inserted
      admin[key] = value;
      modified = true;
    }
  }

  // Add new action keys
  if (admin.actions) {
    for (const [key, value] of Object.entries(NEW_ACTION_KEYS)) {
      if (!(key in admin.actions)) {
        admin.actions[key] = value;
        modified = true;
      }
    }
  }

  // Add new entityType keys
  if (admin.entityTypes) {
    for (const [key, value] of Object.entries(NEW_ENTITY_TYPE_KEYS)) {
      if (!(key in admin.entityTypes)) {
        admin.entityTypes[key] = value;
        modified = true;
      }
    }
  }

  if (modified) {
    // Reorder keys to match en.json structure: put new stat keys after totalUsers
    const orderedAdmin = {};
    const statKeysOrder = [
      'title', 'subtitle', 'pendingPackages', 'openReports', 'todayActions', 'totalUsers',
      'totalPublishedPages', 'totalMoments', 'totalPackages',
      'newUsersToday', 'newUsersThisWeek', 'totalDownloads', 'totalComments',
      'recentModeration', 'pendingQueue', 'noRecentActivity', 'noPendingItems',
      'byAdmin', 'byAuthor', 'actions', 'entityTypes',
      // preserve any remaining keys (packages, comments, collections, pages, etc.)
    ];

    const remainingKeys = Object.keys(admin).filter(k => !statKeysOrder.includes(k));
    const allOrderedKeys = [...statKeysOrder, ...remainingKeys];

    for (const key of allOrderedKeys) {
      if (key in admin) {
        orderedAdmin[key] = admin[key];
      }
    }

    // Also reorder actions and entityTypes
    if (orderedAdmin.actions) {
      const actionOrder = ['approve', 'reject', 'feature', 'unfeature', 'delete', 'warn', 'ban', 'unban', 'hide', 'unhide'];
      const orderedActions = {};
      for (const key of actionOrder) {
        if (key in orderedAdmin.actions) {
          orderedActions[key] = orderedAdmin.actions[key];
        }
      }
      orderedAdmin.actions = orderedActions;
    }

    if (orderedAdmin.entityTypes) {
      const entityOrder = ['mcp', 'skill', 'comment', 'collection', 'user', 'report', 'moment', 'published_page'];
      const orderedEntityTypes = {};
      for (const key of entityOrder) {
        if (key in orderedAdmin.entityTypes) {
          orderedEntityTypes[key] = orderedAdmin.entityTypes[key];
        }
      }
      orderedAdmin.entityTypes = orderedEntityTypes;
    }

    data.dashboard.admin = orderedAdmin;

    // Write back with proper formatting (matching existing style)
    const newContent = JSON.stringify(data, null, 2) + '\n';
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`  UPDATED ${fileName}: added ${modified ? 'keys' : 'none'} (reordered)`);
    return true;
  }

  console.log(`  OK ${fileName}: all keys present`);
  return false;
}

// Files to skip (already complete)
const SKIP_FILES = new Set(['en.json', 'zh-CN.json']);

const files = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json') && !SKIP_FILES.has(f));

console.log(`Processing ${files.length} locale files...\n`);

let updated = 0;
for (const file of files.sort()) {
  const filePath = path.join(LOCALES_DIR, file);
  try {
    if (processFile(filePath)) {
      updated++;
    }
  } catch (err) {
    console.log(`  ERROR ${file}: ${err.message}`);
  }
}

console.log(`\nUpdated ${updated} file(s).`);
