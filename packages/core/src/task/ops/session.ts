/**
 * Task session operations
 *
 * Journal file management and session recording
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, basename } from "node:path";

import type {
  JournalFileInfo,
  SessionMarkdownParams,
  IndexUpdateParams,
} from "./types";

/**
 * Get the latest journal file info from workspace directory
 * Returns: { file: path | null, number: number, lines: number }
 */
export function getLatestJournalInfo(devDir: string): JournalFileInfo {
  if (!existsSync(devDir)) {
    return { file: null, number: 0, lines: 0 };
  }

  let latestFile: string | null = null;
  let latestNum = -1;

  try {
    const files = readdirSync(devDir);
    for (const file of files) {
      if (file.startsWith("journal-") && file.endsWith(".md")) {
        const match = file.match(/journal-(\d+)\.md$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > latestNum) {
            latestNum = num;
            latestFile = join(devDir, file);
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  if (latestFile) {
    let lines = 0;
    try {
      const content = readFileSync(latestFile, "utf-8");
      const splitLines = content.split("\n");
      // Match Python's splitlines() behavior - don't count trailing empty line
      if (splitLines.length > 0 && splitLines[splitLines.length - 1] === "") {
        lines = splitLines.length - 1;
      } else {
        lines = splitLines.length;
      }
    } catch {
      // Ignore errors
    }
    return { file: latestFile, number: latestNum, lines };
  }

  return { file: null, number: 0, lines: 0 };
}

/**
 * Get current session number from index.md by parsing "Total Sessions" line
 */
export function getSessionNumberFromIndex(indexPath: string): number {
  if (!existsSync(indexPath)) {
    return 0;
  }

  try {
    const content = readFileSync(indexPath, "utf-8");
    for (const line of content.split("\n")) {
      if (line.includes("Total Sessions")) {
        const match = line.match(/:\s*(\d+)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return 0;
}

/**
 * Generate session content markdown
 */
export function generateSessionMarkdown(params: SessionMarkdownParams): string {
  const { sessionNum, title, commit, summary, extraContent, date } = params;

  let commitTable: string;
  if (commit && commit !== "-") {
    const lines = ["| Hash | Message |", "|------|---------|"];
    for (const c of commit.split(",")) {
      const trimmed = c.trim();
      lines.push(`| \`${trimmed}\` | (see git log) |`);
    }
    commitTable = lines.join("\n");
  } else {
    commitTable = "(No commits - planning session)";
  }

  return `

## Session ${sessionNum}: ${title}

**Date**: ${date}
**Task**: ${title}

### Summary

${summary}

### Main Changes

${extraContent}

### Git Commits

${commitTable}

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
`;
}

/**
 * Create a new journal file when current one exceeds MAX_LINES
 */
export function createNewJournalFile(
  devDir: string,
  number: number,
  developer: string,
  date: string,
  prevNumber: number
): string {
  const newFilePath = join(devDir, `journal-${number}.md`);
  const maxLines = 2000;

  const content = `# Journal - ${developer} (Part ${number})

> Continuation from \`journal-${prevNumber}.md\` (archived at ~${maxLines} lines)
> Started: ${date}

---

`;

  writeFileSync(newFilePath, content, "utf-8");
  return newFilePath;
}

/**
 * Count journal files and return markdown table rows
 */
export function countJournalFilesTable(devDir: string, activeNum: number): string {
  const activeFile = `journal-${activeNum}.md`;
  const resultLines: string[] = [];

  try {
    const files = readdirSync(devDir)
      .filter((f) => f.startsWith("journal-") && f.endsWith(".md"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/(\d+)/)?.[1] ?? "0", 10);
        const numB = parseInt(b.match(/(\d+)/)?.[1] ?? "0", 10);
        return numB - numA; // Descending order
      });

    for (const filename of files) {
      const filePath = join(devDir, filename);
      let lines = 0;
      try {
        const content = readFileSync(filePath, "utf-8");
        const splitLines = content.split("\n");
        if (splitLines.length > 0 && splitLines[splitLines.length - 1] === "") {
          lines = splitLines.length - 1;
        } else {
          lines = splitLines.length;
        }
      } catch {
        // Ignore errors
      }
      const status = filename === activeFile ? "Active" : "Archived";
      resultLines.push(`| \`${filename}\` | ~${lines} | ${status} |`);
    }
  } catch {
    // Ignore errors
  }

  return resultLines.join("\n");
}

/**
 * Update index.md with new session info
 * Processes sections marked with @@@auto markers
 */
export function updateIndexWithNewSession(params: IndexUpdateParams): boolean {
  const { indexPath, devDir, sessionNum, title, commit, activeFile, date } = params;

  if (!existsSync(indexPath)) {
    return false;
  }

  // Format commit for display
  let commitDisplay = "-";
  if (commit && commit !== "-") {
    commitDisplay = commit
      .split(",")
      .map((c) => `\`${c.trim()}\``)
      .join(", ");
  }

  // Get active file number and count all journal files
  const match = activeFile.match(/journal-(\d+)\.md$/);
  const activeNum = match ? parseInt(match[1], 10) : 0;
  const filesTable = countJournalFilesTable(devDir, activeNum);

  try {
    const content = readFileSync(indexPath, "utf-8");

    if (!content.includes("@@@auto:current-status")) {
      return false;
    }

    const lines = content.split("\n");
    const newLines: string[] = [];

    let inCurrentStatus = false;
    let inActiveDocuments = false;
    let inSessionHistory = false;
    let headerWritten = false;

    for (const line of lines) {
      if (line.includes("@@@auto:current-status")) {
        newLines.push(line);
        inCurrentStatus = true;
        newLines.push(`- **Active File**: \`${activeFile}\``);
        newLines.push(`- **Total Sessions**: ${sessionNum}`);
        newLines.push(`- **Last Active**: ${date}`);
        continue;
      }

      if (line.includes("@@@/auto:current-status")) {
        inCurrentStatus = false;
        newLines.push(line);
        continue;
      }

      if (line.includes("@@@auto:active-documents")) {
        newLines.push(line);
        inActiveDocuments = true;
        newLines.push("| File | Lines | Status |");
        newLines.push("|------|-------|--------|");
        newLines.push(filesTable);
        continue;
      }

      if (line.includes("@@@/auto:active-documents")) {
        inActiveDocuments = false;
        newLines.push(line);
        continue;
      }

      if (line.includes("@@@auto:session-history")) {
        newLines.push(line);
        inSessionHistory = true;
        headerWritten = false;
        continue;
      }

      if (line.includes("@@@/auto:session-history")) {
        inSessionHistory = false;
        newLines.push(line);
        continue;
      }

      if (inCurrentStatus) {
        continue;
      }

      if (inActiveDocuments) {
        continue;
      }

      if (inSessionHistory) {
        newLines.push(line);
        if (/^\|\s*-/.test(line) && !headerWritten) {
          newLines.push(`| ${sessionNum} | ${date} | ${title} | ${commitDisplay} |`);
          headerWritten = true;
        }
        continue;
      }

      newLines.push(line);
    }

    writeFileSync(indexPath, newLines.join("\n"), "utf-8");
    return true;
  } catch {
    return false;
  }
}
