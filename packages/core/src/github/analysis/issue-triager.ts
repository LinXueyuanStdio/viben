/**
 * Issue Triager
 *
 * Batch classification and deduplication of GitHub issues:
 * - Priority assignment
 * - Duplicate detection
 * - Spam detection
 * - Label suggestions
 */

import type { GHIssue } from "../gh-client";
import type { GitHubModelConfig } from "../config";

// ============================================================================
// Types
// ============================================================================

/**
 * Priority level
 */
export type IssuePriority = "urgent" | "high" | "medium" | "low";

/**
 * Triage result for a single issue
 */
export interface TriageResult {
  /** Issue number */
  issue_number: number;
  /** Suggested labels */
  suggested_labels: string[];
  /** Assigned priority */
  priority: IssuePriority;
  /** Whether this is a duplicate */
  is_duplicate: boolean;
  /** Original issue number if duplicate */
  duplicate_of?: number;
  /** Whether this looks like spam */
  is_spam: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Brief reason for triage decision */
  reason?: string;
}

/**
 * Batch triage result
 */
export interface BatchTriageResult {
  /** Results for each issue */
  results: TriageResult[];
  /** Summary statistics */
  summary: {
    total: number;
    by_priority: Record<IssuePriority, number>;
    duplicates: number;
    spam: number;
  };
  /** Triaged timestamp */
  triaged_at: string;
}

// ============================================================================
// Priority Detection
// ============================================================================

const PRIORITY_INDICATORS = {
  urgent: [
    "urgent",
    "critical",
    "security",
    "vulnerability",
    "crash",
    "data loss",
    "production",
    "outage",
    "exploit",
    "blocker",
  ],
  high: [
    "important",
    "breaking",
    "regression",
    "major",
    "severe",
    "asap",
    "priority",
    "customer",
    "blocking",
  ],
  medium: [
    "bug",
    "issue",
    "problem",
    "fix",
    "update",
    "improve",
  ],
  low: [
    "minor",
    "trivial",
    "nice to have",
    "cosmetic",
    "typo",
    "suggestion",
    "enhancement",
    "question",
  ],
};

/**
 * Detect priority from issue content
 */
function detectPriority(issue: GHIssue): { priority: IssuePriority; confidence: number } {
  const text = `${issue.title} ${issue.body || ""}`.toLowerCase();
  const labels = issue.labels.map((l) => l.name.toLowerCase()).join(" ");
  const combined = `${text} ${labels}`;

  // Check labels first (most reliable)
  if (labels.includes("critical") || labels.includes("urgent") || labels.includes("security")) {
    return { priority: "urgent", confidence: 0.9 };
  }
  if (labels.includes("high") || labels.includes("priority")) {
    return { priority: "high", confidence: 0.85 };
  }
  if (labels.includes("low") || labels.includes("minor")) {
    return { priority: "low", confidence: 0.85 };
  }

  // Score based on keywords
  let urgentScore = 0;
  let highScore = 0;
  let lowScore = 0;

  for (const keyword of PRIORITY_INDICATORS.urgent) {
    if (combined.includes(keyword)) urgentScore++;
  }
  for (const keyword of PRIORITY_INDICATORS.high) {
    if (combined.includes(keyword)) highScore++;
  }
  for (const keyword of PRIORITY_INDICATORS.low) {
    if (combined.includes(keyword)) lowScore++;
  }

  if (urgentScore >= 2) {
    return { priority: "urgent", confidence: 0.7 + Math.min(urgentScore * 0.05, 0.2) };
  }
  if (highScore >= 2) {
    return { priority: "high", confidence: 0.65 + Math.min(highScore * 0.05, 0.2) };
  }
  if (lowScore >= 2) {
    return { priority: "low", confidence: 0.6 + Math.min(lowScore * 0.05, 0.2) };
  }

  return { priority: "medium", confidence: 0.5 };
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate simple text similarity (Jaccard)
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeText(text1).split(" ").filter((w) => w.length > 3));
  const words2 = new Set(normalizeText(text2).split(" ").filter((w) => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Find duplicate issues
 */
function findDuplicates(
  issues: GHIssue[],
  threshold: number = 0.6
): Map<number, { duplicate_of: number; similarity: number }> {
  const duplicates = new Map<number, { duplicate_of: number; similarity: number }>();

  // Sort by creation date (older first)
  const sorted = [...issues].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const currentText = `${current.title} ${current.body || ""}`;

    for (let j = 0; j < i; j++) {
      const older = sorted[j];
      const olderText = `${older.title} ${older.body || ""}`;

      const similarity = calculateSimilarity(currentText, olderText);

      if (similarity >= threshold) {
        duplicates.set(current.number, {
          duplicate_of: older.number,
          similarity,
        });
        break; // Found a duplicate, no need to check more
      }
    }
  }

  return duplicates;
}

// ============================================================================
// Spam Detection
// ============================================================================

const SPAM_INDICATORS = [
  // Common spam patterns
  /\b(click here|free money|win|prize|lottery|casino)\b/i,
  /\b(viagra|cialis|pharmacy|pills)\b/i,
  /\b(xxx|porn|adult|sex)\b/i,
  // Excessive links
  /https?:\/\/[^\s]+/g,
  // All caps (shouting)
  /^[A-Z\s]{50,}$/,
  // Gibberish (no real words)
  /^[^aeiou]{20,}$/i,
];

/**
 * Detect if issue is spam
 */
function detectSpam(issue: GHIssue): { is_spam: boolean; confidence: number; reason?: string } {
  const text = `${issue.title} ${issue.body || ""}`;

  // Check for spam patterns
  for (const pattern of SPAM_INDICATORS.slice(0, -2)) {
    if (pattern.test(text)) {
      return { is_spam: true, confidence: 0.9, reason: "Contains spam keywords" };
    }
  }

  // Check for excessive links
  const linkMatches = text.match(SPAM_INDICATORS[6]);
  if (linkMatches && linkMatches.length > 10) {
    return { is_spam: true, confidence: 0.8, reason: "Too many links" };
  }

  // Check for very short/empty body with no labels
  if ((!issue.body || issue.body.length < 10) && issue.labels.length === 0) {
    return { is_spam: false, confidence: 0.3, reason: "Low quality but not spam" };
  }

  // Check for new accounts with suspicious patterns
  // (This would need user creation date, which we don't have)

  return { is_spam: false, confidence: 0.1 };
}

// ============================================================================
// Label Suggestions
// ============================================================================

const LABEL_PATTERNS: Array<{ pattern: RegExp; labels: string[] }> = [
  { pattern: /\b(bug|fix|error|crash|broken|fail)\b/i, labels: ["bug"] },
  { pattern: /\b(feature|request|new|add|support)\b/i, labels: ["feature"] },
  { pattern: /\b(enhance|improve|better|optimize)\b/i, labels: ["enhancement"] },
  { pattern: /\b(docs?|documentation|readme)\b/i, labels: ["documentation"] },
  { pattern: /\b(test|spec|coverage)\b/i, labels: ["testing"] },
  { pattern: /\b(security|vulnerability|cve)\b/i, labels: ["security"] },
  { pattern: /\b(performance|slow|memory|cpu)\b/i, labels: ["performance"] },
  { pattern: /\b(ui|ux|design|style|css)\b/i, labels: ["ui"] },
  { pattern: /\b(api|endpoint|rest|graphql)\b/i, labels: ["api"] },
  { pattern: /\b(windows|linux|macos|mac|platform)\b/i, labels: ["platform"] },
];

/**
 * Suggest labels for an issue
 */
function suggestLabels(issue: GHIssue): string[] {
  const text = `${issue.title} ${issue.body || ""}`.toLowerCase();
  const suggested = new Set<string>();

  for (const { pattern, labels } of LABEL_PATTERNS) {
    if (pattern.test(text)) {
      labels.forEach((l) => suggested.add(l));
    }
  }

  // Remove labels that already exist
  const existing = new Set(issue.labels.map((l) => l.name.toLowerCase()));
  return [...suggested].filter((l) => !existing.has(l)).slice(0, 5);
}

// ============================================================================
// Main Triage Function
// ============================================================================

/**
 * Triage a single issue
 */
export function triageIssue(
  issue: GHIssue,
  existingIssues?: GHIssue[]
): TriageResult {
  // Detect spam first
  const spamResult = detectSpam(issue);
  if (spamResult.is_spam) {
    return {
      issue_number: issue.number,
      suggested_labels: ["spam"],
      priority: "low",
      is_duplicate: false,
      is_spam: true,
      confidence: spamResult.confidence,
      reason: spamResult.reason,
    };
  }

  // Detect priority
  const priorityResult = detectPriority(issue);

  // Check for duplicates
  let isDuplicate = false;
  let duplicateOf: number | undefined;

  if (existingIssues && existingIssues.length > 0) {
    const duplicates = findDuplicates([...existingIssues, issue]);
    const dup = duplicates.get(issue.number);
    if (dup) {
      isDuplicate = true;
      duplicateOf = dup.duplicate_of;
    }
  }

  // Suggest labels
  const labels = suggestLabels(issue);

  return {
    issue_number: issue.number,
    suggested_labels: labels,
    priority: priorityResult.priority,
    is_duplicate: isDuplicate,
    duplicate_of: duplicateOf,
    is_spam: false,
    confidence: priorityResult.confidence,
  };
}

/**
 * Batch triage multiple issues
 */
export function triageIssues(issues: GHIssue[]): BatchTriageResult {
  const results: TriageResult[] = [];

  // Process each issue with context of previous issues
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    const previousIssues = issues.slice(0, i);
    const result = triageIssue(issue, previousIssues);
    results.push(result);
  }

  // Calculate summary
  const summary = {
    total: issues.length,
    by_priority: {
      urgent: results.filter((r) => r.priority === "urgent").length,
      high: results.filter((r) => r.priority === "high").length,
      medium: results.filter((r) => r.priority === "medium").length,
      low: results.filter((r) => r.priority === "low").length,
    },
    duplicates: results.filter((r) => r.is_duplicate).length,
    spam: results.filter((r) => r.is_spam).length,
  };

  return {
    results,
    summary,
    triaged_at: new Date().toISOString(),
  };
}

/**
 * AI-powered batch triage (placeholder)
 */
export async function triageIssuesWithAI(
  issues: GHIssue[],
  _modelConfig: GitHubModelConfig
): Promise<BatchTriageResult> {
  // For now, use heuristic triage
  // TODO: Implement actual AI-powered triage
  return triageIssues(issues);
}
