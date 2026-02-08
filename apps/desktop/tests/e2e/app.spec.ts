import { browser, $ } from '@wdio/globals';

describe('Viben Desktop App', () => {
  it('should launch the application', async () => {
    // Wait for the app window to be ready
    await browser.waitUntil(
      async () => {
        const title = await browser.getTitle();
        return title !== '';
      },
      { timeout: 30000, timeoutMsg: 'App did not launch in time' }
    );

    // Verify we have a window
    const handles = await browser.getWindowHandles();
    expect(handles.length).toBeGreaterThan(0);
  });

  it('should have the correct window title', async () => {
    const title = await browser.getTitle();
    expect(title).toContain('Viben');
  });

  it('should render the main content', async () => {
    // Wait for the root element to be present
    const root = await $('#root');
    await root.waitForExist({ timeout: 10000 });
    expect(await root.isExisting()).toBe(true);
  });

  it('should display the navigation or main layout', async () => {
    // Wait for the app to fully load
    await browser.pause(2000);

    // Check if any main content is rendered
    const body = await $('body');
    const html = await body.getHTML();
    expect(html.length).toBeGreaterThan(0);
  });
});

describe('Window Controls', () => {
  it('should be able to get window size', async () => {
    const size = await browser.getWindowRect();
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });

  it('should be able to resize window', async () => {
    await browser.setWindowRect(0, 0, 1024, 768);
    const size = await browser.getWindowRect();
    expect(size.width).toBe(1024);
    expect(size.height).toBe(768);
  });
});
