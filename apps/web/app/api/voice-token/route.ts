// app/api/voice-token/route.ts
// Vocal Bridge token proxy - bypasses CORS for desktop app
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const VOCAL_BRIDGE_TOKEN_URL = 'https://vocalbridgeai.com/api/v1/token';

interface TokenRequest {
  api_key: string;
  agent_id: string;
  participant_name?: string;
}

interface TokenResponse {
  livekit_url: string;
  token: string;
  room_name: string;
  participant_identity: string;
  expires_in: number;
  agent_mode: string;
}

interface ErrorResponse {
  error: string;
  code?: string;
}

/**
 * 获取语音会话 token
 * @description 代理 Vocal Bridge API（vocalbridgeai.com）获取 LiveKit 语音会话凭证，用于桌面端的语音交互功能。本端点不做登录检查，由 Vocal Bridge 外部服务验证 api_key 身份。agent_id 需为有效的智能体 UUID。CORS 允许任意来源。
 * @body VoiceTokenBody
 * @response 200:VoiceTokenResponse:语音 token 凭证，含 livekit_url、token、room_name、participant_identity、expires_in、agent_mode
 * @response 400:ErrorResponse:缺少 api_key或 agent_id
 * @response 401:ErrorResponse:api_key 无效（转发 Vocal Bridge 错误）
 * @response 403:ErrorResponse:使用额度超限（转发 Vocal Bridge 错误）
 * @response 404:ErrorResponse:智能体不存在（转发 Vocal Bridge 错误）
 * @response 500:ErrorResponse:代理请求失败或内部错误
 * @tag Voice
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TokenRequest;

    const { api_key, agent_id, participant_name = 'User' } = body;

    if (!api_key) {
      return NextResponse.json(
        { error: 'api_key is required', code: 'MISSING_API_KEY' } as ErrorResponse,
        { status: 400 }
      );
    }

    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required', code: 'MISSING_AGENT_ID' } as ErrorResponse,
        { status: 400 }
      );
    }

    console.log('[voice-token] Requesting token for agent:', agent_id);

    const response = await fetch(VOCAL_BRIDGE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': api_key,
        'X-Agent-Id': agent_id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participant_name,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[voice-token] Vocal Bridge error:', response.status, errorText);

      let errorCode = 'TOKEN_FETCH_FAILED';
      if (response.status === 401) {
        errorCode = 'INVALID_API_KEY';
      } else if (response.status === 403) {
        errorCode = 'USAGE_LIMIT_EXCEEDED';
      } else if (response.status === 404) {
        errorCode = 'AGENT_NOT_FOUND';
      }

      return NextResponse.json(
        {
          error: `Failed to get token: ${response.status} ${response.statusText}`,
          code: errorCode,
        } as ErrorResponse,
        { status: response.status }
      );
    }

    const data = await response.json() as TokenResponse;
    console.log('[voice-token] Token obtained successfully');

    return NextResponse.json(data);
  } catch (error) {
    console.error('[voice-token] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get voice token',
        code: 'INTERNAL_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

/**
 * CORS 预检请求
 * @description 处理浏览器跨域预检请求（OPTIONS），响应头允许任意来源（Access-Control-Allow-Origin: *）、POST 和 OPTIONS 方法、以及 Content-Type 和 Authorization 请求头。用于桌面端 WebView 调用时的 CORS 兼容。
 * @response 204
 * @tag Voice
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
