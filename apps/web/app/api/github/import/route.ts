import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, githubConnections, drafts } from '@/lib/db';
import { getSession, decryptToken } from '@/lib/auth';
import { GithubImportBody, type GitHubContent } from '@/lib/validations/github';
import { generateId, slugify } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

// Draft expiry duration: 30 days in milliseconds
const DRAFT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Parse SKILL.md content to extract metadata.
 */
function parseSkillMd(content: string): { name: string; description: string; content: string } {
  const lines = content.split('\n');
  let name = '';
  let description = '';
  let contentStart = 0;
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
        continue;
      } else {
        contentStart = i + 1;
        break;
      }
    }

    if (inFrontmatter) {
      const nameMatch = line.match(/^name:\s*(.+)$/i);
      if (nameMatch) {
        name = nameMatch[1].trim();
      }

      const descMatch = line.match(/^description:\s*(.+)$/i);
      if (descMatch) {
        description = descMatch[1].trim();
      }
    }
  }

  // If no frontmatter, try to extract from first heading
  if (!name) {
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      name = headingMatch[1].trim();
    }
  }

  // If still no name, use filename
  if (!name) {
    name = 'Untitled Skill';
  }

  // Extract first paragraph as description if not found
  if (!description) {
    const contentLines = lines.slice(contentStart);
    for (const line of contentLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        description = trimmed.substring(0, 200);
        break;
      }
    }
  }

  return {
    name,
    description: description || 'No description provided',
    content: lines.slice(contentStart).join('\n').trim() || content,
  };
}

/** @ignore */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const input = GithubImportBody.parse(body);

    // Get GitHub connection
    const connection = await db.query.githubConnections.findFirst({
      where: eq(githubConnections.userId, session.userId),
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      );
    }

    // Decrypt access token
    const accessToken = await decryptToken(connection.accessTokenEncrypted);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to decrypt GitHub access token' },
        { status: 500 }
      );
    }

    const createdDrafts: Array<{
      id: string;
      name: string;
      slug: string;
      path: string;
    }> = [];
    const errors: Array<{ path: string; error: string }> = [];

    // Process each skill
    for (const skill of input.skills) {
      try {
        // Fetch the skill file content
        const url = `https://api.github.com/repos/${input.owner}/${input.repo}/contents/${skill.path}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!response.ok) {
          errors.push({
            path: skill.path,
            error: `Failed to fetch file: ${response.status}`,
          });
          continue;
        }

        const fileData: GitHubContent = await response.json();

        if (!fileData.content || fileData.encoding !== 'base64') {
          errors.push({
            path: skill.path,
            error: 'Invalid file content',
          });
          continue;
        }

        // Decode base64 content
        const rawContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        const parsed = parseSkillMd(rawContent);

        // Use provided name/slug or parsed values
        const skillName = skill.name || parsed.name;
        const skillSlug = skill.slug || slugify(skillName);
        const skillDescription = skill.description || parsed.description;

        // Create draft
        const draftId = generateId();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + DRAFT_EXPIRY_MS);

        await db.insert(drafts).values({
          id: draftId,
          userId: session.userId,
          packageType: 'skill',
          data: {
            step: 2, // Start at edit step
            importSource: 'github',
            name: skillName,
            slug: skillSlug,
            description: skillDescription,
            content: parsed.content,
            skillType: 'command',
            tags: [],
            category: 'general',
            compatibility: [],
            dependencies: [],
            // Store source info for reference
            _source: {
              type: 'github',
              owner: input.owner,
              repo: input.repo,
              path: skill.path,
            },
          },
          createdAt: now,
          updatedAt: now,
          expiresAt,
        });

        createdDrafts.push({
          id: draftId,
          name: skillName,
          slug: skillSlug,
          path: skill.path,
        });
      } catch (err) {
        console.error(`Failed to import skill at ${skill.path}:`, err);
        errors.push({
          path: skill.path,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      imported: createdDrafts,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: input.skills.length,
        imported: createdDrafts.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Import skills error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
