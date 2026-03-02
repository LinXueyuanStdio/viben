/**
 * Batch Cluster
 *
 * Semantic clustering of GitHub issues:
 * - Group similar issues together
 * - Generate combined specifications
 * - Support batch processing
 */

import type { GHIssue } from "../gh-client";
import type { GitHubModelConfig } from "../config";

// ============================================================================
// Types
// ============================================================================

/**
 * Issue cluster
 */
export interface IssueCluster {
  /** Unique cluster ID */
  cluster_id: string;
  /** Theme/title for this cluster */
  theme: string;
  /** Issue numbers in this cluster */
  issue_numbers: number[];
  /** Combined specification (if generated) */
  combined_spec?: string;
  /** Keywords common to all issues */
  common_keywords: string[];
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Clustering result
 */
export interface ClusteringResult {
  /** Generated clusters */
  clusters: IssueCluster[];
  /** Issues that couldn't be clustered */
  unclustered: number[];
  /** Clustering statistics */
  stats: {
    total_issues: number;
    total_clusters: number;
    avg_cluster_size: number;
    unclustered_count: number;
  };
  /** Clustered timestamp */
  clustered_at: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Common stop words to filter out during keyword extraction
 * Defined at module level to avoid recreating on each function call
 */
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare",
  "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
  "into", "through", "during", "before", "after", "above", "below",
  "between", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "each", "few", "more",
  "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "and", "but", "if", "or",
  "because", "until", "while", "this", "that", "these", "those", "it",
  "its", "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
  "she", "her", "they", "them", "their", "what", "which", "who", "whom",
]);

// ============================================================================
// Text Processing
// ============================================================================

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  // Normalize and tokenize
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Count frequencies
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // Sort by frequency and return top keywords
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

/**
 * Calculate Jaccard similarity between two keyword sets
 */
function keywordSimilarity(keywords1: string[], keywords2: string[]): number {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);

  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter((k) => set2.has(k)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Build text content for an issue
 */
function buildIssueText(issue: GHIssue): string {
  return [
    issue.title,
    issue.body || "",
    issue.labels.map((l) => l.name).join(" "),
  ].join(" ");
}

// ============================================================================
// Clustering Algorithm
// ============================================================================

/**
 * Simple hierarchical clustering
 */
function hierarchicalCluster(
  issues: GHIssue[],
  similarityThreshold: number,
  maxClusterSize: number
): Map<number, number[]> {
  // Extract keywords for each issue
  const issueKeywords = new Map<number, string[]>();
  for (const issue of issues) {
    const text = buildIssueText(issue);
    issueKeywords.set(issue.number, extractKeywords(text));
  }

  // Build similarity matrix
  const similarities = new Map<string, number>();
  for (let i = 0; i < issues.length; i++) {
    for (let j = i + 1; j < issues.length; j++) {
      const keywords1 = issueKeywords.get(issues[i].number)!;
      const keywords2 = issueKeywords.get(issues[j].number)!;
      const sim = keywordSimilarity(keywords1, keywords2);
      const key = `${issues[i].number}-${issues[j].number}`;
      similarities.set(key, sim);
    }
  }

  // Initialize each issue as its own cluster
  const clusters = new Map<number, Set<number>>();
  for (const issue of issues) {
    clusters.set(issue.number, new Set([issue.number]));
  }

  // Merge clusters iteratively
  let changed = true;
  while (changed) {
    changed = false;

    // Find most similar pair of clusters
    let bestPair: [number, number] | null = null;
    let bestSim = similarityThreshold;

    for (const [id1, cluster1] of clusters) {
      for (const [id2, cluster2] of clusters) {
        if (id1 >= id2) continue;

        // Skip if merged cluster would be too large
        if (cluster1.size + cluster2.size > maxClusterSize) continue;

        // Calculate average linkage similarity
        let totalSim = 0;
        let count = 0;
        for (const i of cluster1) {
          for (const j of cluster2) {
            const key = i < j ? `${i}-${j}` : `${j}-${i}`;
            totalSim += similarities.get(key) || 0;
            count++;
          }
        }
        const avgSim = count > 0 ? totalSim / count : 0;

        if (avgSim > bestSim) {
          bestSim = avgSim;
          bestPair = [id1, id2];
        }
      }
    }

    // Merge best pair
    if (bestPair) {
      const [id1, id2] = bestPair;
      const merged = new Set([...clusters.get(id1)!, ...clusters.get(id2)!]);
      clusters.delete(id2);
      clusters.set(id1, merged);
      changed = true;
    }
  }

  // Convert to result format
  const result = new Map<number, number[]>();
  let clusterIndex = 0;
  for (const members of clusters.values()) {
    if (members.size > 1) {
      result.set(clusterIndex++, [...members]);
    }
  }

  return result;
}

/**
 * Generate theme for a cluster
 */
function generateClusterTheme(issues: GHIssue[]): string {
  // Get all keywords
  const allKeywords: string[] = [];
  for (const issue of issues) {
    const text = buildIssueText(issue);
    allKeywords.push(...extractKeywords(text));
  }

  // Find most common keywords
  const freq = new Map<string, number>();
  for (const kw of allKeywords) {
    freq.set(kw, (freq.get(kw) || 0) + 1);
  }

  const topKeywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kw]) => kw);

  // Capitalize and join
  return topKeywords
    .map((kw) => kw.charAt(0).toUpperCase() + kw.slice(1))
    .join(" / ") || "Related Issues";
}

/**
 * Generate combined spec for a cluster
 */
function generateCombinedSpec(issues: GHIssue[]): string {
  const lines: string[] = [];

  lines.push(`# Combined Specification`);
  lines.push(``);
  lines.push(`## Issues`);
  for (const issue of issues) {
    lines.push(`- #${issue.number}: ${issue.title}`);
  }
  lines.push(``);

  lines.push(`## Common Requirements`);
  // Extract requirements from all issues
  const allRequirements = new Set<string>();
  for (const issue of issues) {
    const body = issue.body || "";
    const checkboxes = body.match(/- \[([ x])\] (.+)/g) || [];
    checkboxes.forEach((cb) => {
      const text = cb.replace(/- \[([ x])\] /, "").trim();
      allRequirements.add(text);
    });
  }
  if (allRequirements.size > 0) {
    for (const req of allRequirements) {
      lines.push(`- ${req}`);
    }
  } else {
    lines.push(`- Review all linked issues for specific requirements`);
  }
  lines.push(``);

  lines.push(`## Affected Areas`);
  // Get unique labels
  const labels = new Set<string>();
  for (const issue of issues) {
    issue.labels.forEach((l) => labels.add(l.name));
  }
  for (const label of labels) {
    lines.push(`- ${label}`);
  }
  lines.push(``);

  lines.push(`## Implementation Notes`);
  lines.push(`- These issues have been grouped due to semantic similarity`);
  lines.push(`- Consider implementing them together for efficiency`);
  lines.push(`- Ensure changes don't introduce regressions across all issues`);

  return lines.join("\n");
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Cluster issues by semantic similarity
 */
export function clusterIssues(
  issues: GHIssue[],
  options?: {
    similarityThreshold?: number;
    maxClusterSize?: number;
  }
): ClusteringResult {
  const threshold = options?.similarityThreshold ?? 0.3;
  const maxSize = options?.maxClusterSize ?? 5;

  if (issues.length < 2) {
    return {
      clusters: [],
      unclustered: issues.map((i) => i.number),
      stats: {
        total_issues: issues.length,
        total_clusters: 0,
        avg_cluster_size: 0,
        unclustered_count: issues.length,
      },
      clustered_at: new Date().toISOString(),
    };
  }

  // Run clustering algorithm
  const clusterMap = hierarchicalCluster(issues, threshold, maxSize);

  // Build result clusters
  const clusters: IssueCluster[] = [];
  const clusteredIssues = new Set<number>();

  let clusterId = 0;
  for (const members of clusterMap.values()) {
    const clusterIssues = issues.filter((i) => members.includes(i.number));

    // Get common keywords
    const commonKeywords: string[] = [];
    const keywordSets = clusterIssues.map((i) =>
      new Set(extractKeywords(buildIssueText(i)))
    );
    if (keywordSets.length > 0) {
      const first = keywordSets[0];
      for (const kw of first) {
        if (keywordSets.every((s) => s.has(kw))) {
          commonKeywords.push(kw);
        }
      }
    }

    clusters.push({
      cluster_id: `cluster-${clusterId++}`,
      theme: generateClusterTheme(clusterIssues),
      issue_numbers: members,
      combined_spec: generateCombinedSpec(clusterIssues),
      common_keywords: commonKeywords.slice(0, 10),
      confidence: 0.7,
    });

    members.forEach((n) => clusteredIssues.add(n));
  }

  // Find unclustered issues
  const unclustered = issues
    .filter((i) => !clusteredIssues.has(i.number))
    .map((i) => i.number);

  // Calculate stats
  const avgClusterSize = clusters.length > 0
    ? clusters.reduce((sum, c) => sum + c.issue_numbers.length, 0) / clusters.length
    : 0;

  return {
    clusters,
    unclustered,
    stats: {
      total_issues: issues.length,
      total_clusters: clusters.length,
      avg_cluster_size: avgClusterSize,
      unclustered_count: unclustered.length,
    },
    clustered_at: new Date().toISOString(),
  };
}

/**
 * AI-powered clustering (placeholder)
 */
export async function clusterIssuesWithAI(
  issues: GHIssue[],
  _modelConfig: GitHubModelConfig,
  options?: {
    similarityThreshold?: number;
    maxClusterSize?: number;
  }
): Promise<ClusteringResult> {
  // For now, use heuristic clustering
  // TODO: Implement actual AI-powered clustering with embeddings
  return clusterIssues(issues, options);
}
