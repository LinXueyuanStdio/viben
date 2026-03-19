/**
 * GitHub Import Service
 *
 * Handles batch import of GitHub issues as spec files.
 */

import { investigateIssues } from "./investigation";
import { listIssues } from "./issues";
import type { GitHubIssueInvestigation } from "../../types/github";

/**
 * Import result
 */
export interface ImportResult {
  /** Total issues requested */
  total: number;
  /** Successfully imported */
  imported: number;
  /** Failed imports */
  failed: number;
  /** Results for each issue */
  results: GitHubIssueInvestigation[];
  /** Error messages for failed imports */
  errors: Array<{ issue_number: number; error: string }>;
}

/**
 * Import GitHub issues as spec files
 * @param workspacePath - Absolute path to the workspace
 * @param issueNumbers - Issue numbers to import
 * @returns Import results
 */
export async function importIssues(
  workspacePath: string,
  issueNumbers: number[]
): Promise<ImportResult> {
  const results: GitHubIssueInvestigation[] = [];
  const errors: Array<{ issue_number: number; error: string }> = [];

  for (const issueNumber of issueNumbers) {
    try {
      // Use investigation service with saveSpec=true
      const investigations = await investigateIssues(workspacePath, [issueNumber], true);
      if (investigations.length > 0) {
        results.push(investigations[0]);
      }
    } catch (error) {
      errors.push({
        issue_number: issueNumber,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    total: issueNumbers.length,
    imported: results.length,
    failed: errors.length,
    results,
    errors,
  };
}

/**
 * Import all open issues from repository
 * @param workspacePath - Absolute path to the workspace
 * @param maxIssues - Maximum number of issues to import
 * @returns Import results
 */
export async function importAllOpenIssues(
  workspacePath: string,
  maxIssues: number = 50
): Promise<ImportResult> {
  // Fetch open issues
  const { items: issues } = await listIssues(workspacePath, {
    state: "open",
    per_page: maxIssues,
  });

  const issueNumbers = issues.map((i) => i.number);
  return importIssues(workspacePath, issueNumbers);
}
