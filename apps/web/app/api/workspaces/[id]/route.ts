import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWorkspace, updateWorkspace, deleteWorkspace } from '@/lib/services/workspaces';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const workspace = await getWorkspace(id);

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Failed to get workspace:', error);
    return NextResponse.json(
      { error: 'Failed to get workspace' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const parsed = updateWorkspaceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const workspace = await updateWorkspace(id, session.userId, parsed.data);

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Failed to update workspace:', error);
    return NextResponse.json(
      { error: 'Failed to update workspace' },
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
    const deleted = await deleteWorkspace(id, session.userId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Workspace not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete workspace:', error);
    return NextResponse.json(
      { error: 'Failed to delete workspace' },
      { status: 500 }
    );
  }
}
