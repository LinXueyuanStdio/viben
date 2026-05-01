import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import RegionScreenshot from 'region-screenshot-js';
import './screenshot-overlay.css';

/**
 * Screenshot Overlay Page
 *
 * Fullscreen overlay window for region selection + annotation.
 * Workflow:
 * 1. Receives screenshot image path via URL query param
 * 2. Displays it as fullscreen background
 * 3. Initializes region-screenshot-js for selection + annotation
 * 4. On confirm, emits screenshot-result event back to main window
 * 5. Closes overlay
 */
export function ScreenshotOverlayPage() {
  const [searchParams] = useSearchParams();
  const imagePath = searchParams.get('image') || '';
  const containerRef = useRef<HTMLDivElement>(null);
  const screenshotRef = useRef<RegionScreenshot | null>(null);

  const handleClose = useCallback(async () => {
    await invoke('close_screenshot_overlay', { imagePath });
  }, [imagePath]);

  const handleScreenshotGenerated = useCallback(
    async (base64Data: string) => {
      // Emit result to main window
      await emit('screenshot-result', {
        data: base64Data,
        type: 'region',
      });
      // Close overlay
      await handleClose();
    },
    [handleClose],
  );

  useEffect(() => {
    if (!imagePath || !containerRef.current) return;

    // Convert file path to asset URL for Tauri
    const imageUrl = convertFileSrc(imagePath);

    // Set as page background
    document.body.style.backgroundImage = `url(${imageUrl})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';

    // Initialize region-screenshot-js
    const screenshot = new RegionScreenshot({
      maskColor: 'rgba(0, 0, 0, 0.45)',
      regionColor: '#409eff',
      globalColorOptions: [
        '#ff3a3a',
        '#f8b60f',
        '#0083ff',
        '#40ff00',
        '#363636',
        '#ffffff',
      ],
    });

    screenshotRef.current = screenshot;

    // Listen for screenshot generated (user confirmed)
    screenshot.on('screenshotGenerated', (dataUrl: string) => {
      handleScreenshotGenerated(dataUrl);
    });

    // Listen for close (user cancelled)
    screenshot.on('closed', () => {
      handleClose();
    });

    // Handle Escape key for cancel
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      screenshotRef.current = null;
    };
  }, [imagePath, handleClose, handleScreenshotGenerated]);

  return <div ref={containerRef} className="screenshot-overlay-container" />;
}
