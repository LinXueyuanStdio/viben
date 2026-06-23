import type { YooEditor } from "@yoopta/editor";

/**
 * Reliable DOM-level focus for Yoopta blocks.
 *
 * Yoopta's built-in focusBlock uses setTimeout(0) + ReactEditor.focus(slate),
 * which silently fails when the DOM element hasn't rendered yet. This utility
 * bypasses that entirely by:
 *   1. Polling with requestAnimationFrame until the block's [contenteditable] appears
 *   2. Calling native .focus() directly on the DOM element
 *   3. Updating editor.path.current so useSlashCommand etc. re-attach their listeners
 *   4. Optionally running a callback after focus is confirmed
 *
 * @param editor     The YooEditor instance
 * @param blockId    The block to focus
 * @param onFocused  Optional callback invoked once focus succeeds
 * @param maxRetries Number of rAF frames to wait (default 20 ≈ 330ms at 60fps)
 */
export function ensureBlockFocus(
  editor: YooEditor,
  blockId: string,
  onFocused?: () => void,
  maxRetries = 20,
) {
  let retries = 0;
  const tryFocus = () => {
    const el = editor.refElement?.querySelector(
      `[data-yoopta-block-id="${blockId}"] [contenteditable="true"]`,
    ) as HTMLElement | null;

    if (el) {
      el.focus();
      // Sync editor.path so useSlashCommand and other hooks see the correct block
      const block = editor.children[blockId];
      if (block) {
        editor.setPath({ current: block.meta.order });
      }
      onFocused?.();
      return;
    }

    if (retries < maxRetries) {
      retries++;
      requestAnimationFrame(tryFocus);
    }
  };
  requestAnimationFrame(tryFocus);
}
