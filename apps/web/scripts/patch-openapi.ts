#!/usr/bin/env npx tsx
/**
 * 给 next-openapi-gen 生成的 spec 注入 components.securitySchemes。
 * authPresets 只做 @auth bearer → BearerAuth 名称映射，不生成 scheme 定义。
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(__dirname, '..', 'public', 'openapi.json');

async function main() {
  const raw = await readFile(SPEC_PATH, 'utf-8');
  const spec = JSON.parse(raw) as Record<string, unknown>;

  // 清除模板配置 key，不应出现在最终 OpenAPI spec 中
  delete spec.exclude;

  const components = (spec.components ??= {}) as Record<string, unknown>;
  (components.securitySchemes ??= {}) as Record<string, unknown>;

  (components.securitySchemes as Record<string, unknown>).BearerAuth = {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'API Key / JWE Token',
    description: 'API Key（bmcp_ 前缀）或 JWE session token',
  };

  (components.securitySchemes as Record<string, unknown>).SessionAuth = {
    type: 'apiKey',
    in: 'cookie',
    name: 'session',
    description: '登录后浏览器自动携带的 session cookie',
  };

  await writeFile(SPEC_PATH, JSON.stringify(spec, null, 2), 'utf-8');
  console.log('[patch-openapi] securitySchemes injected');
}

main().catch((err) => {
  console.error('[patch-openapi] Error:', err);
  process.exit(1);
});
