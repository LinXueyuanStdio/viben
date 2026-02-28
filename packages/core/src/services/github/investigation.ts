/**
 * GitHub Investigation Service
 *
 * Handles AI analysis of GitHub issues:
 * - Issue investigation
 * - Complexity assessment
 * - Spec file generation
 */

import { writeFile } from "node:fs/promises";
import { stringify } from "yaml";
import { getIssueWithComments } from "./issues";
import { requireRepository } from "./repository";
import {
  ensureSpecsDir,
  getIssueSpecPath,
} from "./utils";
import type {
  GitHubIssue,
  GitHubComment,
  GitHubIssueInvestigation,
  SpecFile,
} from "../../types/github";

// ============================================================================
// Investigation Logic
// ============================================================================

/**
 * Complexity keywords for assessment
 */
const COMPLEXITY_KEYWORDS = {
  simple: [
    "typo",
    "fix",
    "small",
    "minor",
    "simple",
    "easy",
    "quick",
    "update",
    "change",
    "rename",
  ],
  complex: [
    "refactor",
    "redesign",
    "architecture",
    "breaking",
    "major",
    "complex",
    "difficult",
    "migration",
    "security",
    "performance",
    "database",
    "schema",
  ],
};

/**
 * Estimate complexity based on issue content
 */
function estimateComplexity(issue: GitHubIssue, comments: GitHubComment[]): "simple" | "medium" | "complex" {
  const text = [
    issue.title,
    issue.body || "",
    ...comments.map((c) => c.body),
  ].join(" ").toLowerCase();

  // Check for complexity keywords
  const hasSimpleKeywords = COMPLEXITY_KEYWORDS.simple.some((kw) => text.includes(kw));
  const hasComplexKeywords = COMPLEXITY_KEYWORDS.complex.some((kw) => text.includes(kw));

  // Check labels
  const labelNames = issue.labels.map((l) => l.name.toLowerCase());
  const hasBugLabel = labelNames.some((l) => l.includes("bug"));
  const hasEnhancementLabel = labelNames.some((l) => l.includes("enhancement") || l.includes("feature"));
  const hasRefactorLabel = labelNames.some((l) => l.includes("refactor"));

  // Heuristic scoring
  let complexityScore = 0;

  if (hasComplexKeywords) complexityScore += 2;
  if (hasRefactorLabel) complexityScore += 2;
  if (hasEnhancementLabel) complexityScore += 1;
  if (issue.body && issue.body.length > 1000) complexityScore += 1;
  if (comments.length > 5) complexityScore += 1;

  if (hasSimpleKeywords) complexityScore -= 1;
  if (hasBugLabel && issue.body && issue.body.length < 300) complexityScore -= 1;

  if (complexityScore >= 3) return "complex";
  if (complexityScore <= 0) return "simple";
  return "medium";
}

/**
 * Estimate affected files based on issue content
 */
function estimateAffectedFiles(issue: GitHubIssue, comments: GitHubComment[]): number {
  const text = [
    issue.title,
    issue.body || "",
    ...comments.map((c) => c.body),
  ].join(" ");

  // Look for file references
  const filePatterns = [
    /`[^`]+\.(ts|tsx|js|jsx|py|rs|go|java|rb|php|css|scss|html|vue|svelte)`/gi,
    /(?:src|lib|app|packages)\/[a-zA-Z0-9_/-]+\.[a-zA-Z]+/gi,
  ];

  const mentionedFiles = new Set<string>();
  for (const pattern of filePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((m) => mentionedFiles.add(m));
    }
  }

  // Base estimate on complexity and mentioned files
  const complexity = estimateComplexity(issue, comments);
  const baseCounts = { simple: 2, medium: 5, complex: 10 };

  return Math.max(mentionedFiles.size, baseCounts[complexity]);
}

/**
 * Extract affected areas from issue content
 */
function extractAffectedAreas(issue: GitHubIssue, comments: GitHubComment[]): string[] {
  const text = [
    issue.title,
    issue.body || "",
    ...comments.map((c) => c.body),
  ].join(" ");

  const areas = new Set<string>();

  // Common area patterns
  const areaPatterns = [
    { pattern: /\b(?:frontend|ui|ux|component|react|vue|angular)/gi, area: "frontend" },
    { pattern: /\b(?:backend|api|server|route|endpoint|database)/gi, area: "backend" },
    { pattern: /\b(?:auth|authentication|login|session)/gi, area: "authentication" },
    { pattern: /\b(?:test|testing|spec|coverage)/gi, area: "testing" },
    { pattern: /\b(?:doc|documentation|readme)/gi, area: "documentation" },
    { pattern: /\b(?:build|ci|cd|deploy|docker)/gi, area: "infrastructure" },
    { pattern: /\b(?:style|css|scss|tailwind)/gi, area: "styling" },
    { pattern: /\b(?:type|typescript|interface)/gi, area: "types" },
  ];

  for (const { pattern, area } of areaPatterns) {
    if (pattern.test(text)) {
      areas.add(area);
    }
  }

  // Extract directory paths
  const pathPattern = /(?:src|lib|app|packages)\/[a-zA-Z0-9_-]+/g;
  const matches = text.match(pathPattern);
  if (matches) {
    matches.forEach((m) => areas.add(m));
  }

  return Array.from(areas).slice(0, 10);
}

/**
 * Generate implementation hints from issue content
 */
function generateImplementationHints(
  issue: GitHubIssue,
  comments: GitHubComment[]
): string[] {
  const hints: string[] = [];
  const text = [issue.body || "", ...comments.map((c) => c.body)].join("\n");

  // Look for code blocks
  const codeBlockPattern = /```[\s\S]*?```/g;
  const codeBlocks = text.match(codeBlockPattern);
  if (codeBlocks && codeBlocks.length > 0) {
    hints.push(`Review ${codeBlocks.length} code example(s) in the issue discussion`);
  }

  // Look for file references
  const fileRefs = text.match(/`[^`]+\.(ts|tsx|js|jsx)`/g);
  if (fileRefs) {
    hints.push(`Check referenced files: ${fileRefs.slice(0, 3).join(", ")}`);
  }

  // Look for URLs
  const urlPattern = /https?:\/\/[^\s)]+/g;
  const urls = text.match(urlPattern);
  if (urls && urls.length > 0) {
    const docUrls = urls.filter((u) =>
      u.includes("docs") || u.includes("documentation") || u.includes("github.com")
    );
    if (docUrls.length > 0) {
      hints.push(`Reference documentation: ${docUrls[0]}`);
    }
  }

  // Add label-based hints
  const labelNames = issue.labels.map((l) => l.name.toLowerCase());
  if (labelNames.some((l) => l.includes("bug"))) {
    hints.push("This is a bug fix - ensure regression tests are added");
  }
  if (labelNames.some((l) => l.includes("enhancement") || l.includes("feature"))) {
    hints.push("This is a new feature - consider documentation updates");
  }
  if (labelNames.some((l) => l.includes("breaking"))) {
    hints.push("This may introduce breaking changes - update changelog and migration guide");
  }

  return hints.slice(0, 5);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Investigate a GitHub issue
 * @param workspacePath - Absolute path to the workspace
 * @param issueNumber - Issue number to investigate
 * @param saveSpec - Whether to save spec file
 * @returns Investigation results
 */
export async function investigateIssue(
  workspacePath: string,
  issueNumber: number,
  saveSpec: boolean = false
): Promise<GitHubIssueInvestigation> {
  const repo = await requireRepository(workspacePath);
  const { issue, comments } = await getIssueWithComments(workspacePath, issueNumber);

  // Analyze issue
  const complexity = estimateComplexity(issue, comments);
  const estimatedFiles = estimateAffectedFiles(issue, comments);
  const affectedAreas = extractAffectedAreas(issue, comments);
  const implementationHints = generateImplementationHints(issue, comments);

  // Build investigation result
  const investigation: GitHubIssueInvestigation = {
    issue_number: issueNumber,
    complexity,
    estimated_files: estimatedFiles,
    affected_areas: affectedAreas,
    implementation_hints: implementationHints,
  };

  // Generate and save spec if requested
  if (saveSpec) {
    const specFile = generateSpecFile(issue, comments, investigation, repo.url);
    const specPath = await saveSpecFile(workspacePath, issueNumber, specFile);

    investigation.spec_content = stringify(specFile);
    investigation.spec_path = specPath;
  }

  return investigation;
}

/**
 * Generate a spec file from investigation
 */
function generateSpecFile(
  issue: GitHubIssue,
  comments: GitHubComment[],
  investigation: GitHubIssueInvestigation,
  repoUrl: string
): SpecFile {
  // Extract requirements from issue body
  const requirements: string[] = [];

  if (issue.body) {
    // Look for checkbox items
    const checkboxPattern = /- \[([ x])\] (.+)/g;
    let match;
    while ((match = checkboxPattern.exec(issue.body)) !== null) {
      requirements.push(match[2].trim());
    }

    // Look for numbered lists
    const numberedPattern = /^\d+\.\s+(.+)/gm;
    while ((match = numberedPattern.exec(issue.body)) !== null) {
      if (!requirements.includes(match[1].trim())) {
        requirements.push(match[1].trim());
      }
    }
  }

  // If no explicit requirements found, extract from title and body
  if (requirements.length === 0) {
    requirements.push(issue.title);
    if (issue.body && issue.body.length < 500) {
      requirements.push(issue.body.split("\n")[0]);
    }
  }

  return {
    source: {
      type: "github_issue",
      number: issue.number,
      url: issue.html_url,
      synced_at: new Date().toISOString(),
    },
    analysis: {
      complexity: investigation.complexity,
      estimated_files: investigation.estimated_files,
      affected_areas: investigation.affected_areas,
    },
    spec: {
      title: issue.title,
      description: issue.body || issue.title,
      requirements: requirements.slice(0, 10),
      implementation_hints: investigation.implementation_hints,
    },
  };
}

/**
 * Save spec file to workspace
 */
async function saveSpecFile(
  workspacePath: string,
  issueNumber: number,
  specFile: SpecFile
): Promise<string> {
  await ensureSpecsDir(workspacePath);
  const specPath = getIssueSpecPath(workspacePath, issueNumber);
  const content = stringify(specFile, { indent: 2 });
  await writeFile(specPath, content, "utf-8");
  return specPath;
}

/**
 * Batch investigate multiple issues
 * @param workspacePath - Absolute path to the workspace
 * @param issueNumbers - Issue numbers to investigate
 * @param saveSpecs - Whether to save spec files
 * @returns Investigation results for each issue
 */
export async function investigateIssues(
  workspacePath: string,
  issueNumbers: number[],
  saveSpecs: boolean = false
): Promise<GitHubIssueInvestigation[]> {
  const results: GitHubIssueInvestigation[] = [];

  for (const issueNumber of issueNumbers) {
    try {
      const investigation = await investigateIssue(workspacePath, issueNumber, saveSpecs);
      results.push(investigation);
    } catch (error) {
      // Log error but continue with other issues
      console.error(`Failed to investigate issue #${issueNumber}:`, error);
    }
  }

  return results;
}
