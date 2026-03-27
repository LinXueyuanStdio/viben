/**
 * Skill marketplace operations
 *
 * Operations for listing and searching skills from the marketplace.
 * Currently returns mock data - future: integrate with real marketplace API.
 */
import type {
  AvailableSkill,
  MarketplaceSearchOptions,
  MarketplaceResult,
} from "./types";

// =============================================================================
// List Available Skills
// =============================================================================

/**
 * List available skills from marketplace
 *
 * Currently returns mock data (same as Rust implementation).
 * Future: Fetch from marketplace API.
 *
 * @returns Marketplace result with available skills
 */
export async function listAvailableSkills(): Promise<MarketplaceResult> {
  // Mock data - Future: Fetch from marketplace API
  const skills: AvailableSkill[] = [
    {
      name: "code-review",
      version: "1.0.0",
      description: "Code review assistance",
      author: "viben",
      tags: ["code", "review"],
    },
    {
      name: "commit",
      version: "1.2.0",
      description: "Smart commit messages",
      author: "viben",
      tags: ["git", "commit"],
    },
    {
      name: "test-runner",
      version: "0.9.0",
      description: "Test execution helper",
      author: "viben",
      tags: ["test", "runner"],
    },
    {
      name: "doc-gen",
      version: "1.1.0",
      description: "Generate documentation from code",
      author: "viben",
      tags: ["docs", "generator"],
    },
    {
      name: "refactor",
      version: "0.8.0",
      description: "Refactoring suggestions and assistance",
      author: "viben",
      tags: ["code", "refactor"],
    },
  ];

  return {
    success: true,
    skills,
    total: skills.length,
  };
}

// =============================================================================
// Search Skills
// =============================================================================

/**
 * Search skills in marketplace
 *
 * @param options - Search options (query, tags, author, limit)
 * @returns Marketplace result with matching skills
 */
export async function searchSkills(
  options?: MarketplaceSearchOptions
): Promise<MarketplaceResult> {
  // Get all available skills first
  const allResult = await listAvailableSkills();
  if (!allResult.success) {
    return allResult;
  }

  let filtered = allResult.skills;

  // Filter by query
  if (options?.query) {
    const query = options.query.toLowerCase();
    filtered = filtered.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query) ||
        skill.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  // Filter by tags
  if (options?.tags && options.tags.length > 0) {
    const searchTags = options.tags.map((t) => t.toLowerCase());
    filtered = filtered.filter((skill) =>
      skill.tags?.some((tag) => searchTags.includes(tag.toLowerCase()))
    );
  }

  // Filter by author
  if (options?.author) {
    const author = options.author.toLowerCase();
    filtered = filtered.filter(
      (skill) => skill.author?.toLowerCase() === author
    );
  }

  // Apply pagination
  const offset = options?.offset || 0;
  const limit = options?.limit || filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    success: true,
    skills: paginated,
    total: filtered.length,
  };
}
