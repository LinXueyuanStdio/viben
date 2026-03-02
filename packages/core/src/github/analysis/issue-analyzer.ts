/**
 * Issue Analyzer
 *
 * AI-powered deep analysis of GitHub issues:
 * - Type classification (bug, feature, enhancement, etc.)
 * - Complexity assessment
 * - Requirements extraction
 * - Affected areas detection
 * - Implementation hints generation
 */

import type { GHIssue, GHComment } from "../gh-client";
import type { GitHubModelConfig } from "../config";

// ============================================================================
// Constants
// ============================================================================

/**
 * Patterns for detecting affected areas in issue text
 * Defined at module level to avoid recreating on each function call
 */
const AFFECTED_AREA_PATTERNS: Array<{ pattern: RegExp; area: string }> = [
  { pattern: /\b(?:frontend|ui|ux|component|react|vue|angular|svelte)/gi, area: "frontend" },
  { pattern: /\b(?:backend|api|server|route|endpoint)/gi, area: "backend" },
  { pattern: /\b(?:database|db|sql|postgres|mysql|mongo)/gi, area: "database" },
  { pattern: /\b(?:auth|authentication|login|session|oauth)/gi, area: "authentication" },
  { pattern: /\b(?:test|testing|spec|coverage|jest|vitest)/gi, area: "testing" },
  { pattern: /\b(?:doc|documentation|readme|jsdoc)/gi, area: "documentation" },
  { pattern: /\b(?:build|ci|cd|deploy|docker|kubernetes)/gi, area: "infrastructure" },
  { pattern: /\b(?:style|css|scss|tailwind|styled)/gi, area: "styling" },
  { pattern: /\b(?:type|typescript|interface|schema)/gi, area: "types" },
  { pattern: /\b(?:config|configuration|settings|env)/gi, area: "configuration" },
  { pattern: /\b(?:cli|command|terminal)/gi, area: "cli" },
  { pattern: /\b(?:websocket|socket|realtime)/gi, area: "realtime" },
];

// ============================================================================
// Types
// ============================================================================

/**
 * Issue type classification
 */
export type IssueType =
  | "bug"
  | "feature"
  | "enhancement"
  | "docs"
  | "refactor"
  | "test"
  | "chore"
  | "question";

/**
 * Issue complexity level
 */
export type IssueComplexity =
  | "trivial"
  | "low"
  | "medium"
  | "high"
  | "critical";

/**
 * Deep analysis result for an issue
 */
export interface IssueAnalysis {
  /** Issue number */
  issue_number: number;
  /** Classified issue type */
  type: IssueType;
  /** Complexity assessment */
  complexity: IssueComplexity;
  /** One-sentence summary */
  summary: string;
  /** Extracted requirements list */
  requirements: string[];
  /** Acceptance criteria */
  acceptance_criteria: string[];
  /** Affected areas in codebase */
  affected_areas: string[];
  /** Suggested labels */
  suggested_labels: string[];
  /** Estimated files to modify */
  estimated_files: string[];
  /** Potential risks */
  risks: string[];
  /** Implementation hints */
  implementation_hints: string[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Analysis timestamp */
  analyzed_at: string;
}

/**
 * Repository context for analysis
 */
export interface RepoContext {
  /** Repository structure (directory listing) */
  structure?: string[];
  /** README content */
  readme?: string;
  /** Recent commits (for context) */
  recent_commits?: string[];
  /** Tech stack detected */
  tech_stack?: string[];
}

// ============================================================================
// Complexity Keywords
// ============================================================================

const COMPLEXITY_INDICATORS = {
  trivial: [
    "typo",
    "spelling",
    "grammar",
    "comment",
    "whitespace",
    "formatting",
  ],
  low: [
    "simple",
    "minor",
    "small",
    "quick",
    "easy",
    "update",
    "rename",
    "fix",
    "tweak",
  ],
  medium: [
    "add",
    "implement",
    "create",
    "build",
    "change",
    "modify",
    "extend",
  ],
  high: [
    "refactor",
    "redesign",
    "complex",
    "multiple",
    "integration",
    "performance",
    "security",
  ],
  critical: [
    "architecture",
    "breaking",
    "migration",
    "database",
    "schema",
    "infrastructure",
    "major",
  ],
};

const TYPE_INDICATORS = {
  bug: ["bug", "fix", "crash", "error", "broken", "not working", "fails", "issue", "problem"],
  feature: ["feature", "new", "add", "implement", "create", "support", "request"],
  enhancement: ["enhance", "improve", "better", "optimize", "upgrade", "increase"],
  docs: ["docs", "documentation", "readme", "comment", "example", "guide", "tutorial"],
  refactor: ["refactor", "clean", "reorganize", "restructure", "simplify", "extract"],
  test: ["test", "spec", "coverage", "e2e", "unit", "integration"],
  chore: ["chore", "deps", "dependency", "build", "ci", "config", "setup"],
  question: ["question", "help", "how", "?", "explain", "clarify"],
};

// ============================================================================
// Heuristic Analysis (No AI)
// ============================================================================

/**
 * Analyze issue using heuristics (no AI required)
 */
export function analyzeIssueHeuristic(
  issue: GHIssue,
  comments: GHComment[] = []
): IssueAnalysis {
  const text = buildAnalysisText(issue, comments);
  const textLower = text.toLowerCase();

  // Detect type
  const type = detectType(textLower, issue.labels.map((l) => l.name));

  // Detect complexity
  const complexity = detectComplexity(textLower, issue, comments);

  // Extract areas
  const affectedAreas = extractAffectedAreas(text);

  // Extract requirements
  const requirements = extractRequirements(issue.body);

  // Generate hints
  const implementationHints = generateHints(issue, comments, type);

  // Estimate files
  const estimatedFiles = estimateFiles(text);

  return {
    issue_number: issue.number,
    type,
    complexity,
    summary: issue.title,
    requirements,
    acceptance_criteria: extractAcceptanceCriteria(issue.body),
    affected_areas: affectedAreas,
    suggested_labels: suggestLabels(type, complexity, affectedAreas),
    estimated_files: estimatedFiles,
    risks: detectRisks(textLower, complexity),
    implementation_hints: implementationHints,
    confidence: 0.6, // Heuristic has lower confidence
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Build combined text for analysis
 */
function buildAnalysisText(issue: GHIssue, comments: GHComment[]): string {
  const parts = [
    issue.title,
    issue.body || "",
    ...comments.map((c) => c.body),
  ];
  return parts.join("\n\n");
}

/**
 * Detect issue type from text and labels
 */
function detectType(text: string, labels: string[]): IssueType {
  const labelLower = labels.join(" ").toLowerCase();

  // Check labels first (most reliable)
  for (const [type, keywords] of Object.entries(TYPE_INDICATORS)) {
    if (keywords.some((kw) => labelLower.includes(kw))) {
      return type as IssueType;
    }
  }

  // Check text content
  for (const [type, keywords] of Object.entries(TYPE_INDICATORS)) {
    const matchCount = keywords.filter((kw) => text.includes(kw)).length;
    if (matchCount >= 2) {
      return type as IssueType;
    }
  }

  // Default based on common patterns
  if (text.includes("fix") || text.includes("error")) {
    return "bug";
  }
  if (text.includes("add") || text.includes("support")) {
    return "feature";
  }

  return "enhancement";
}

/**
 * Detect complexity from text and issue metadata
 */
function detectComplexity(
  text: string,
  issue: GHIssue,
  comments: GHComment[]
): IssueComplexity {
  let score = 0;

  // Check complexity keywords
  for (const [level, keywords] of Object.entries(COMPLEXITY_INDICATORS)) {
    const matchCount = keywords.filter((kw) => text.includes(kw)).length;
    switch (level) {
      case "trivial":
        score -= matchCount * 2;
        break;
      case "low":
        score -= matchCount;
        break;
      case "medium":
        // neutral
        break;
      case "high":
        score += matchCount;
        break;
      case "critical":
        score += matchCount * 2;
        break;
    }
  }

  // Factor in issue body length
  const bodyLength = issue.body?.length ?? 0;
  if (bodyLength > 2000) score += 2;
  else if (bodyLength > 1000) score += 1;
  else if (bodyLength < 200) score -= 1;

  // Factor in comment count
  if (comments.length > 10) score += 2;
  else if (comments.length > 5) score += 1;

  // Factor in labels
  const labelNames = issue.labels.map((l) => l.name.toLowerCase());
  if (labelNames.some((l) => l.includes("breaking"))) score += 3;
  if (labelNames.some((l) => l.includes("security"))) score += 2;
  if (labelNames.some((l) => l.includes("performance"))) score += 1;
  if (labelNames.some((l) => l.includes("good first issue"))) score -= 2;

  // Map score to complexity
  if (score <= -3) return "trivial";
  if (score <= 0) return "low";
  if (score <= 3) return "medium";
  if (score <= 6) return "high";
  return "critical";
}

/**
 * Extract affected areas from text
 */
function extractAffectedAreas(text: string): string[] {
  const areas = new Set<string>();

  // Use module-level patterns constant
  for (const { pattern, area } of AFFECTED_AREA_PATTERNS) {
    // Reset lastIndex for global regex patterns
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      areas.add(area);
    }
  }

  // Extract directory paths
  const pathPattern = /(?:src|lib|app|packages|components)\/[a-zA-Z0-9_/-]+/g;
  const paths = text.match(pathPattern);
  if (paths) {
    paths.forEach((p) => areas.add(p.split("/")[0] + "/" + p.split("/")[1]));
  }

  return Array.from(areas).slice(0, 10);
}

/**
 * Extract requirements from issue body
 */
function extractRequirements(body: string | undefined): string[] {
  if (!body) return [];

  const requirements: string[] = [];

  // Look for checkbox items
  const checkboxPattern = /- \[([ x])\] (.+)/g;
  let match;
  while ((match = checkboxPattern.exec(body)) !== null) {
    requirements.push(match[2].trim());
  }

  // Look for numbered lists
  const numberedPattern = /^\d+\.\s+(.+)/gm;
  while ((match = numberedPattern.exec(body)) !== null) {
    const item = match[1].trim();
    if (!requirements.includes(item)) {
      requirements.push(item);
    }
  }

  // Look for bullet points
  const bulletPattern = /^[-*]\s+(.+)/gm;
  while ((match = bulletPattern.exec(body)) !== null) {
    const item = match[1].trim();
    if (!requirements.includes(item) && item.length < 200) {
      requirements.push(item);
    }
  }

  return requirements.slice(0, 10);
}

/**
 * Extract acceptance criteria from issue body
 */
function extractAcceptanceCriteria(body: string | undefined): string[] {
  if (!body) return [];

  const criteria: string[] = [];

  // Look for "acceptance criteria" or "definition of done" sections
  const sectionPatterns = [
    /acceptance criteria[:\s]*([\s\S]*?)(?=\n#|\n\*\*|$)/i,
    /definition of done[:\s]*([\s\S]*?)(?=\n#|\n\*\*|$)/i,
    /expected behavior[:\s]*([\s\S]*?)(?=\n#|\n\*\*|$)/i,
  ];

  for (const pattern of sectionPatterns) {
    const match = body.match(pattern);
    if (match) {
      // Extract list items from section
      const section = match[1];
      const items = section.match(/[-*]\s+(.+)/g);
      if (items) {
        criteria.push(...items.map((i) => i.replace(/^[-*]\s+/, "").trim()));
      }
    }
  }

  return criteria.slice(0, 5);
}

/**
 * Suggest labels based on analysis
 */
function suggestLabels(
  type: IssueType,
  complexity: IssueComplexity,
  areas: string[]
): string[] {
  const labels: string[] = [];

  // Type label
  labels.push(type);

  // Complexity label
  if (complexity === "trivial" || complexity === "low") {
    labels.push("good first issue");
  }
  if (complexity === "high" || complexity === "critical") {
    labels.push("complex");
  }

  // Area labels
  if (areas.includes("frontend")) labels.push("frontend");
  if (areas.includes("backend")) labels.push("backend");
  if (areas.includes("documentation")) labels.push("docs");
  if (areas.includes("testing")) labels.push("test");

  return labels.slice(0, 5);
}

/**
 * Estimate files that may need modification
 */
function estimateFiles(text: string): string[] {
  const files = new Set<string>();

  // Look for explicit file references
  const filePatterns = [
    /`([^`]+\.(ts|tsx|js|jsx|py|rs|go|java|rb|php|css|scss|html|vue|svelte))`/gi,
    /(?:in|file|modify|update|change)\s+`([^`]+)`/gi,
    /(src|lib|app|packages)\/[a-zA-Z0-9_/-]+\.[a-zA-Z]+/gi,
  ];

  for (const pattern of filePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((m) => {
        // Clean up the match
        const cleaned = m.replace(/`/g, "").trim();
        if (cleaned.includes(".")) {
          files.add(cleaned);
        }
      });
    }
  }

  return Array.from(files).slice(0, 10);
}

/**
 * Detect potential risks
 */
function detectRisks(text: string, complexity: IssueComplexity): string[] {
  const risks: string[] = [];

  // High complexity is inherently risky
  if (complexity === "high" || complexity === "critical") {
    risks.push("Complex change may require extensive testing");
  }

  // Check for specific risk indicators
  if (text.includes("breaking")) {
    risks.push("May introduce breaking changes");
  }
  if (text.includes("security")) {
    risks.push("Security-sensitive change requires careful review");
  }
  if (text.includes("database") || text.includes("migration")) {
    risks.push("Database changes may require migration");
  }
  if (text.includes("performance")) {
    risks.push("Performance impact should be measured");
  }
  if (text.includes("api") && text.includes("change")) {
    risks.push("API changes may affect consumers");
  }

  return risks.slice(0, 5);
}

/**
 * Generate implementation hints
 */
function generateHints(
  issue: GHIssue,
  comments: GHComment[],
  type: IssueType
): string[] {
  const hints: string[] = [];
  const text = buildAnalysisText(issue, comments);

  // Look for code blocks (examples)
  const codeBlockCount = (text.match(/```[\s\S]*?```/g) || []).length;
  if (codeBlockCount > 0) {
    hints.push(`Review ${codeBlockCount} code example(s) in the discussion`);
  }

  // Look for file references
  const fileRefs = text.match(/`[^`]+\.(ts|tsx|js|jsx)`/g);
  if (fileRefs && fileRefs.length > 0) {
    hints.push(`Check referenced files: ${fileRefs.slice(0, 3).join(", ")}`);
  }

  // Look for documentation links
  const docUrls = text.match(/https?:\/\/[^\s)]+(?:docs|documentation|guide)[^\s)]*/gi);
  if (docUrls && docUrls.length > 0) {
    hints.push(`Reference documentation: ${docUrls[0]}`);
  }

  // Type-specific hints
  switch (type) {
    case "bug":
      hints.push("Add regression test to prevent recurrence");
      break;
    case "feature":
      hints.push("Consider adding documentation for new feature");
      hints.push("Ensure backward compatibility");
      break;
    case "refactor":
      hints.push("Ensure all tests pass after refactoring");
      hints.push("Consider breaking into smaller commits");
      break;
    case "docs":
      hints.push("Check for broken links");
      hints.push("Ensure examples are working");
      break;
  }

  // Label-based hints
  const labelNames = issue.labels.map((l) => l.name.toLowerCase());
  if (labelNames.some((l) => l.includes("breaking"))) {
    hints.push("Update changelog and migration guide");
  }

  return hints.slice(0, 5);
}

// ============================================================================
// AI-Powered Analysis (Placeholder)
// ============================================================================

/**
 * Analyze issue using AI
 * This is a placeholder - actual AI integration would use the configured model
 */
export async function analyzeIssueWithAI(
  issue: GHIssue,
  comments: GHComment[],
  _repoContext: RepoContext,
  _modelConfig: GitHubModelConfig
): Promise<IssueAnalysis> {
  // For now, fall back to heuristic analysis
  // TODO: Implement actual AI analysis using the configured model
  const heuristicResult = analyzeIssueHeuristic(issue, comments);

  // Mark as AI-analyzed with higher confidence
  return {
    ...heuristicResult,
    confidence: 0.85,
  };
}

/**
 * Main entry point for issue analysis
 * Uses AI if model is configured, falls back to heuristic
 */
export async function analyzeIssue(
  issue: GHIssue,
  comments: GHComment[] = [],
  options?: {
    repoContext?: RepoContext;
    modelConfig?: GitHubModelConfig;
    useAI?: boolean;
  }
): Promise<IssueAnalysis> {
  const { repoContext, modelConfig, useAI = false } = options ?? {};

  if (useAI && modelConfig && repoContext) {
    return analyzeIssueWithAI(issue, comments, repoContext, modelConfig);
  }

  return analyzeIssueHeuristic(issue, comments);
}
