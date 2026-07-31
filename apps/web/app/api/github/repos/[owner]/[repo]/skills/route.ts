import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, githubConnections } from '@/lib/db';
import { getSession, decryptToken } from '@/lib/auth';
import type { GitHubContent, DetectedSkill } from '@/lib/validations/github';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ owner: string; repo: string }>;
}

/**
 * Parse SKILL.md content to extract metadata.
 * Expected format:
 * ---
 * name: Skill Name
 * description: Short description
 * ---
 * # Content...
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

/**
 * Recursively search for SKILL.md files in a directory.
 */
async function findSkillFiles(
  accessToken: string,
  owner: string,
  repo: string,
  path: string = ''
): Promise<Array<{ path: string; downloadUrl: string }>> {
  const url = path
    ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
    : `https://api.github.com/repos/${owner}/${repo}/contents`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    return [];
  }

  const contents: GitHubContent[] = await response.json();
  const skills: Array<{ path: string; downloadUrl: string }> = [];

  for (const item of contents) {
    // Check for SKILL.md file (case-insensitive)
    if (item.type === 'file' && item.name.toLowerCase() === 'skill.md' && item.download_url) {
      skills.push({ path: item.path, downloadUrl: item.download_url });
    }

    // Recursively search in skills/ directory
    if (item.type === 'dir' && item.name.toLowerCase() === 'skills') {
      const subSkills = await findSkillFilesInDir(accessToken, owner, repo, item.path);
      skills.push(...subSkills);
    }
  }

  return skills;
}

/**
 * Find all SKILL.md files within a directory (for skills/ folder).
 */
async function findSkillFilesInDir(
  accessToken: string,
  owner: string,
  repo: string,
  path: string
): Promise<Array<{ path: string; downloadUrl: string }>> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    return [];
  }

  const contents: GitHubContent[] = await response.json();
  const skills: Array<{ path: string; downloadUrl: string }> = [];

  for (const item of contents) {
    if (item.type === 'file' && item.name.toLowerCase() === 'skill.md' && item.download_url) {
      skills.push({ path: item.path, downloadUrl: item.download_url });
    } else if (item.type === 'dir') {
      // Recursively search subdirectories
      const subSkills = await findSkillFilesInDir(accessToken, owner, repo, item.path);
      skills.push(...subSkills);
    }
  }

  return skills;
}

/**
 * 检测仓库中的 Skills
 * @description 扫描 GitHub 仓库中的 SKILL.md 文件（含 skills/ 目录递归），解析并返回检测到的 Skill 列表
 * @pathParams owner — 仓库所有者
 * @pathParams repo — 仓库名称
 * @response 200:{ skills: DetectedSkill[]; repository: { owner: string; repo: string } } — 检测到的 Skill 列表
 * @response 400:ErrorResponse:未连接 GitHub
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @tag GitHub
 * @ignore
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { owner, repo } = await params;

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

    // Find SKILL.md files in the repository
    const skillFiles = await findSkillFiles(accessToken, owner, repo);

    if (skillFiles.length === 0) {
      return NextResponse.json({
        skills: [],
        message: 'No SKILL.md files found in this repository',
      });
    }

    // Fetch and parse each skill file
    const skills: DetectedSkill[] = [];

    for (const file of skillFiles) {
      try {
        const response = await fetch(file.downloadUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const rawContent = await response.text();
          const parsed = parseSkillMd(rawContent);

          skills.push({
            path: file.path,
            name: parsed.name,
            description: parsed.description,
            content: parsed.content,
          });
        }
      } catch (err) {
        console.error(`Failed to fetch skill at ${file.path}:`, err);
      }
    }

    return NextResponse.json({
      skills,
      repository: {
        owner,
        repo,
      },
    });
  } catch (error) {
    console.error('Detect skills error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
