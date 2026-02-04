import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listWorkspacePackages,
  addPackageToWorkspace,
  removePackageFromWorkspace,
  getWorkspace,
} from '@/lib/services/workspaces';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const addPackageSchema = z.object({
  entityType: z.enum(['mcp', 'skill']),
  entityId: z.string().uuid(),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const removePackageSchema = z.object({
  entityType: z.enum(['mcp', 'skill']),
  entityId: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify workspace access
    const workspace = await getWorkspace(id);
    if (!workspace || workspace.ownerId !== session.userId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const packages = await listWorkspacePackages(id);

    return NextResponse.json({ packages });
  } catch (error) {
    console.error('Failed to list workspace packages:', error);
    return NextResponse.json(
      { error: 'Failed to list workspace packages' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = addPackageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const success = await addPackageToWorkspace(id, session.userId, parsed.data);

    if (!success) {
      return NextResponse.json(
        { error: 'Workspace not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Failed to add package to workspace:', error);
    return NextResponse.json(
      { error: 'Failed to add package to workspace' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = removePackageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const success = await removePackageFromWorkspace(
      id,
      session.userId,
      parsed.data.entityType,
      parsed.data.entityId
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Workspace not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove package from workspace:', error);
    return NextResponse.json(
      { error: 'Failed to remove package from workspace' },
      { status: 500 }
    );
  }
}
