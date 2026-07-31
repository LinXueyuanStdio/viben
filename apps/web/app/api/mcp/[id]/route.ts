import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, mcpPackages } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { McpUpdateBody } from '@/lib/validations/mcp';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

/** @ignore */
// GET - Get MCP package details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const pkg = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, id),
      with: {
        author: {
          columns: {
            id: true,
            username: true,
            userSlug: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    return NextResponse.json({ package: pkg });
  } catch (error) {
    console.error('Get MCP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** @ignore */
// PUT - Update MCP package
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const data = McpUpdateBody.parse(body);

    // Check ownership
    const pkg = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, id),
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    if (pkg.authorId !== session.userId && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'You are not the owner of this package' },
        { status: 403 }
      );
    }

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== pkg.slug) {
      const existing = await db.query.mcpPackages.findFirst({
        where: eq(mcpPackages.slug, data.slug),
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Package slug already exists' },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.longDescription !== undefined)
      updateData.longDescription = data.longDescription || null;
    if (data.transport !== undefined) updateData.transport = data.transport;
    if (data.entryPoint !== undefined) updateData.entryPoint = data.entryPoint;
    if (data.repositoryUrl !== undefined)
      updateData.repositoryUrl = data.repositoryUrl || null;
    if (data.homepageUrl !== undefined)
      updateData.homepageUrl = data.homepageUrl || null;
    if (data.license !== undefined) updateData.license = data.license;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.configSchema !== undefined)
      updateData.configSchema = data.configSchema || null;
    if (data.dependencies !== undefined) updateData.dependencies = data.dependencies;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await db.update(mcpPackages).set(updateData).where(eq(mcpPackages.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Update MCP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** @ignore */
// DELETE - Delete MCP package
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    // Check ownership
    const pkg = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, id),
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    if (pkg.authorId !== session.userId && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'You are not the owner of this package' },
        { status: 403 }
      );
    }

    await db.delete(mcpPackages).where(eq(mcpPackages.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete MCP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
