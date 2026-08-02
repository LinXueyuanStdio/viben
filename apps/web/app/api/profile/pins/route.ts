import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, profilePins } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const saveSchema = z.object({
  pins: z.array(z.object({
    entity_type: z.enum(['page', 'mcp', 'skill']),
    entity_id: z.string(),
    position: z.number().int().min(0),
  })).max(6),
});

/**
 * 获取当前用户的置顶项
 * @description 返回当前用户的所有置顶项，按 position 升序排列。需登录。
 * @response 200:ProfilePinsResponse:置顶项列表
 * @response 401:ErrorResponse:未登录
 * @responseSet auth
 * @tag Profile
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pins = await db.query.profilePins.findMany({
      where: eq(profilePins.userId, session.userId),
      orderBy: (pins, { asc }) => [asc(pins.position)],
    });

    return NextResponse.json({ pins });
  } catch (error) {
    console.error('Get profile pins error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 批量保存置顶项
 * @description 替换当前用户的所有置顶项，最多 6 个。按 position 排序。需登录。
 * @body SavePinsBody
 * @response 200:SavePinsResponse:保存成功
 * @response 400:ErrorResponse:请求无效或超过上限
 * @response 401:ErrorResponse:未登录
 * @responseSet auth
 * @tag Profile
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pins } = saveSchema.parse(body);

    if (pins.length > 6) {
      return NextResponse.json(
        { error: 'Maximum 6 pinned items allowed' },
        { status: 400 }
      );
    }

    // Delete all existing pins for this user, then insert new ones
    await db.delete(profilePins).where(eq(profilePins.userId, session.userId));

    if (pins.length > 0) {
      await db.insert(profilePins).values(
        pins.map((p) => ({
          userId: session.userId,
          entityType: p.entity_type,
          entityId: p.entity_id,
          position: p.position,
        }))
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Save profile pins error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
