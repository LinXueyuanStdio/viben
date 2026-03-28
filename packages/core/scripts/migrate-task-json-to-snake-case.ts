#!/usr/bin/env npx tsx
/**
 * Migration script: Convert task.json fields from camelCase to snake_case
 *
 * This script converts all task.json files in the repository from the old
 * camelCase naming convention to the new snake_case convention.
 *
 * Usage:
 *   npx tsx packages/core/scripts/migrate-task-json-to-snake-case.ts [--dry-run]
 *
 * Options:
 *   --dry-run  Show what would be changed without actually modifying files
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { glob } from "glob";
import { dirname, join } from "node:path";

// Field mapping from camelCase to snake_case
const FIELD_MAPPING: Record<string, string> = {
  // Timestamps
  createdAt: "created_at",
  updatedAt: "updated_at",
  completedAt: "completed_at",
  startedAt: "started_at",
  queuedAt: "queued_at",
  checkPassedAt: "check_passed_at",
  prCreatedAt: "pr_created_at",

  // State machine
  reviewReason: "review_reason",
  rejectReason: "reject_reason",
  xstateState: "xstate_state",
  lastEvent: "last_event",
  eventHistory: "event_history",

  // Relationships
  dependsOn: "depends_on",
  parentTaskId: "parent_task_id",
  childTaskIds: "child_task_ids",

  // Context
  subtaskDetails: "subtask_details",
  executionProgress: "execution_progress",
  relatedFiles: "related_files",
  contextFiles: "context_files",

  // Agent/Session
  sessionId: "session_id",
  taskIndex: "task_index",
  workspacePath: "workspace_path",
  autoStart: "auto_start",

  // PR related
  prUrl: "pr_url",
  baseBranch: "base_branch",

  // Execution
  lastToolActivity: "last_tool_activity",
  waitingForInput: "waiting_for_input",
};

// Nested field mappings for complex objects
const NESTED_FIELD_MAPPING: Record<string, Record<string, string>> = {
  executionProgress: {
    currentPhase: "current_phase",
    currentStep: "current_step",
    totalSteps: "total_steps",
    completedSteps: "completed_steps",
  },
  subtaskDetails: {
    taskId: "task_id",
    parentId: "parent_id",
    createdAt: "created_at",
    completedAt: "completed_at",
    estimatedEffort: "estimated_effort",
  },
  lastEvent: {
    eventId: "event_id",
  },
  eventHistory: {
    eventId: "event_id",
  },
};

interface MigrationResult {
  file: string;
  changed: boolean;
  oldFields: string[];
  newFields: string[];
}

function migrateObject(obj: unknown, parentKey?: string): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => migrateObject(item, parentKey));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    const record = obj as Record<string, unknown>;

    for (const key of Object.keys(record)) {
      // Get the new key name
      let newKey = FIELD_MAPPING[key] || key;

      // Check for nested field mappings
      if (parentKey && NESTED_FIELD_MAPPING[parentKey]?.[key]) {
        newKey = NESTED_FIELD_MAPPING[parentKey][key];
      }

      // Recursively migrate the value
      const value = record[key];
      const migratedValue = migrateObject(value, key);

      result[newKey] = migratedValue;
    }

    return result;
  }

  return obj;
}

function migrateTaskJson(filePath: string, dryRun: boolean): MigrationResult {
  const content = readFileSync(filePath, "utf-8");
  let data: Record<string, unknown>;

  try {
    data = JSON.parse(content);
  } catch {
    console.error(`  Error parsing ${filePath}`);
    return { file: filePath, changed: false, oldFields: [], newFields: [] };
  }

  // Find fields that will be changed
  const oldFields: string[] = [];
  const newFields: string[] = [];

  function findChangedFields(obj: Record<string, unknown>, prefix = ""): void {
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const newKey = FIELD_MAPPING[key];

      if (newKey) {
        oldFields.push(fullKey);
        newFields.push(prefix ? `${prefix}.${newKey}` : newKey);
      }

      // Check nested objects
      if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
        findChangedFields(obj[key] as Record<string, unknown>, fullKey);
      }

      // Check arrays of objects
      if (Array.isArray(obj[key])) {
        for (const item of obj[key] as unknown[]) {
          if (item && typeof item === "object") {
            findChangedFields(item as Record<string, unknown>, fullKey);
          }
        }
      }
    }
  }

  findChangedFields(data);

  const changed = oldFields.length > 0;

  if (changed && !dryRun) {
    const migratedData = migrateObject(data) as Record<string, unknown>;
    const newContent = JSON.stringify(migratedData, null, 2) + "\n";
    writeFileSync(filePath, newContent, "utf-8");
  }

  return { file: filePath, changed, oldFields, newFields };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No files will be modified\n");
  }

  // Find the repository root
  let repoRoot = process.cwd();
  while (!existsSync(join(repoRoot, ".git")) && dirname(repoRoot) !== repoRoot) {
    repoRoot = dirname(repoRoot);
  }

  console.log(`Repository root: ${repoRoot}\n`);

  // Find all task.json files
  const patterns = [
    join(repoRoot, ".viben/tasks/**/task.json"),
    join(repoRoot, "**/.viben/tasks/**/task.json"),
  ];

  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { ignore: ["**/node_modules/**"] });
    files.push(...matches);
  }

  // Deduplicate
  const uniqueFiles = [...new Set(files)];

  console.log(`Found ${uniqueFiles.length} task.json files\n`);

  let changedCount = 0;
  let unchangedCount = 0;

  for (const file of uniqueFiles) {
    const result = migrateTaskJson(file, dryRun);

    if (result.changed) {
      changedCount++;
      console.log(`✏️  ${file}`);
      for (let i = 0; i < result.oldFields.length; i++) {
        console.log(`    ${result.oldFields[i]} → ${result.newFields[i]}`);
      }
    } else {
      unchangedCount++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Summary:`);
  console.log(`  Changed: ${changedCount} files`);
  console.log(`  Unchanged: ${unchangedCount} files`);

  if (dryRun && changedCount > 0) {
    console.log(`\nRun without --dry-run to apply changes.`);
  }
}

main().catch(console.error);
