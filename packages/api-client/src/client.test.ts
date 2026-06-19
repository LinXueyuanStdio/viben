import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VibenClient } from './client';

describe('VibenClient pages API', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        page_uid: 'demo',
        url: '/page/demo',
        updated: false,
      }),
    });
  });

  it('publishes a page with bearer auth and JSON body', async () => {
    const client = new VibenClient({
      baseUrl: 'https://viben-web.vercel.app',
      apiKey: 'session-token',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await client.pages.publish({
      uid: 'demo',
      title: 'Demo',
      icon: { type: 'lucide', value: 'file-text' },
      description: 'Demo page',
      html: '<html><body>Demo</body></html>',
    });

    expect(result).toEqual({
      success: true,
      page_uid: 'demo',
      url: '/page/demo',
      updated: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://viben-web.vercel.app/api/pages/publish',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer session-token',
        },
        body: JSON.stringify({
          uid: 'demo',
          title: 'Demo',
          icon: { type: 'lucide', value: 'file-text' },
          description: 'Demo page',
          html: '<html><body>Demo</body></html>',
        }),
      })
    );
  });
});
