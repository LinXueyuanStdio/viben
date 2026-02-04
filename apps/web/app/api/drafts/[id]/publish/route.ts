import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, drafts, mcpPackages, skillPackages } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { mcpDraftDataSchema, skillDraftDataSchema } from '@/lib/validations/draft';
import { generateId } from '@/lib/utils';
import { eq, and } from 'drizzle-orm';
import { ZodError } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Publish draft (convert to MCP or Skill package)
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can publish (developer or higher)
    if (session.role === 'user') {
      return NextResponse.json(
        { error: 'Only developers can publish packages' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Get the draft
    const draft = await db.query.drafts.findFirst({
      where: and(
        eq(drafts.id, id),
        eq(drafts.userId, session.userId)
      ),
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Check if draft is expired
    if (new Date(draft.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Draft has expired. Please create a new draft.' },
        { status: 400 }
      );
    }

    const packageId = generateId();
    const draftData = draft.data as Record<string, unknown>;

    if (draft.packageType === 'mcp') {
      // Validate MCP draft data
      const validatedData = mcpDraftDataSchema.parse(draftData);

      // Check if slug is unique
      const existingMcp = await db.query.mcpPackages.findFirst({
        where: eq(mcpPackages.slug, validatedData.slug),
      });

      if (existingMcp) {
        return NextResponse.json(
          { error: 'Package slug already exists' },
          { status: 400 }
        );
      }

      // Create MCP package
      await db.insert(mcpPackages).values({
        id: packageId,
        name: validatedData.name,
        slug: validatedData.slug,
        version: validatedData.version,
        description: validatedData.description,
        longDescription: validatedData.longDescription || null,
        transport: validatedData.transport,
        entryPoint: validatedData.entryPoint,
        repositoryUrl: validatedData.repositoryUrl || null,
        homepageUrl: validatedData.homepageUrl || null,
        license: validatedData.license,
        tags: validatedData.tags,
        category: validatedData.category,
        configSchema: validatedData.configSchema || null,
        dependencies: validatedData.dependencies,
        authorId: session.userId,
        isPublished: false, // Start as unpublished, needs review
        status: 'pending',
      });

      // Delete the draft
      await db.delete(drafts).where(eq(drafts.id, id));

      return NextResponse.json({
        success: true,
        package: {
          id: packageId,
          type: 'mcp',
          slug: validatedData.slug,
        },
      });
    } else if (draft.packageType === 'skill') {
      // Validate Skill draft data
      const validatedData = skillDraftDataSchema.parse(draftData);

      // Check if slug is unique
      const existingSkill = await db.query.skillPackages.findFirst({
        where: eq(skillPackages.slug, validatedData.slug),
      });

      if (existingSkill) {
        return NextResponse.json(
          { error: 'Package slug already exists' },
          { status: 400 }
        );
      }

      // Create Skill package
      await db.insert(skillPackages).values({
        id: packageId,
        name: validatedData.name,
        slug: validatedData.slug,
        version: validatedData.version,
        description: validatedData.description,
        longDescription: validatedData.longDescription || null,
        skillType: validatedData.skillType,
        triggerPatterns: validatedData.triggerPatterns,
        content: validatedData.content,
        tags: validatedData.tags,
        category: validatedData.category,
        compatibility: validatedData.compatibility,
        configSchema: validatedData.configSchema || null,
        dependencies: validatedData.dependencies,
        authorId: session.userId,
        isPublished: false, // Start as unpublished, needs review
        status: 'pending',
      });

      // Delete the draft
      await db.delete(drafts).where(eq(drafts.id, id));

      return NextResponse.json({
        success: true,
        package: {
          id: packageId,
          type: 'skill',
          slug: validatedData.slug,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid package type' },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Draft data is incomplete or invalid',
          details: error.issues,
        },
        { status: 400 }
      );
    }
    console.error('Publish draft error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
