import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { downloadPackage } from '@/lib/services/packages';

/** @ignore */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id } = await params;

    const version = request.nextUrl.searchParams.get('version') || undefined;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const result = await downloadPackage({
      entityType: 'mcp',
      entityId: id,
      version,
      userId: session?.userId,
      ipAddress,
      userAgent,
    });

    return new NextResponse(result.file, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': result.file.length.toString(),
        'X-Version': result.release.version,
        'X-Checksum': result.release.checksum || '',
      },
    });
  } catch (error) {
    console.error('Failed to download MCP package:', error);
    const message = error instanceof Error ? error.message : 'Failed to download package';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
