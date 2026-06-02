import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts/windows/test-desktop-summary.bat');

describe('Windows desktop summary script', () => {
  test('uploads screenshots to ci-assets and writes markdown image links', async () => {
    const script = await readFile(scriptPath, 'utf8');

    expect(script).toContain('upload-ci-assets.bat');
    expect(script).toContain('UPLOADED_URLS.txt');
    expect(script).toContain('windows/!GITHUB_RUN_ID!');
    expect(script).toContain('^![!DESC!^](!URL!^)');
    expect(script).not.toContain('_共 !SCREENSHOT_COUNT! 张截图，详见 artifacts_');
  });
});
