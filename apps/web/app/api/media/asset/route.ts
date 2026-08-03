import { get } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

/**
 * 媒体资源代理
 * @summary 代理获取媒体资源
 * @description 通过 Vercel Blob 私有存储获取媒体资源。成功时返回原始二进制流（Cache-Control: private, no-cache，Content-Type 取自 Blob 元数据，回退为 application/octet-stream，X-Content-Type-Options: nosniff）。资源不存在时返回 404 纯文本 "Not found"。异常时返回 JSON 错误
 * @params MediaAssetQuery — pathname 查询参数指定 Blob 存储路径
 * @response 200
 * @response 400:ErrorResponse:缺少 pathname 参数
 * @response 404
 * @response 500:ErrorResponse:获取资源失败
 * @tag Media
 */
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.searchParams.get("pathname");
  if (!pathname) {
    return NextResponse.json({ error: "Missing pathname" }, { status: 400 });
  }

  try {
    const result = await get(pathname, {
      access: "private",
    });
    if (result === null) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        // 前端长久缓存：图片上传后内容不变，1 年有效期
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": result.blob.contentType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Blob proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch asset" }, { status: 500 });
  }
}
