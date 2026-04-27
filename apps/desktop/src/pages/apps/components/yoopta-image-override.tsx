/**
 * Custom Image element override for Yoopta themes-shadcn.
 *
 * Problem: The default ImageUI from @yoopta/themes-shadcn shows the inline
 * toolbar only when `isElementSelected && isBlockSelected` (Slate selection).
 * In practice the selection state is unstable for void elements — the toolbar
 * appears and immediately disappears.
 *
 * Fix: We re-export the default ImageUI but wrap the rendered image component
 * so that the toolbar is controlled by **hover + click** rather than pure
 * Slate selection. Specifically we keep the block selected (via editor.setPath)
 * while the user is hovering the image area.
 */

import { useCallback, useRef, useState } from "react";
import {
  useYooptaEditor,
  useBlockSelected,
  Elements,
  Blocks,
  type SlateElement,
} from "@yoopta/editor";
import type { RenderElementProps } from "@yoopta/editor";
import { ImageUI } from "@yoopta/themes-shadcn";

/**
 * A thin wrapper around the theme's image render component.
 *
 * It intercepts the element render and adds mouseenter / mouseleave handlers
 * that ensure the block stays "selected" (editor.path.current) while the
 * user hovers, which keeps the inline toolbar visible.
 */
function ImageRenderWrapper(props: RenderElementProps<SlateElement>) {
  const editor = useYooptaEditor();
  const { blockId } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep editor.path.current pinned to this block while hovering
  const handleMouseEnter = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovering(true);

    // Ensure this block is selected so the theme's toolbar appears
    const block = Blocks.getBlock(editor, { id: blockId });
    if (block && editor.path.current !== block.meta.order) {
      editor.setPath({ current: block.meta.order });
    }
  }, [editor, blockId]);

  const handleMouseLeave = useCallback(() => {
    // Small delay so moving between image and toolbar doesn't flicker
    hoverTimerRef.current = setTimeout(() => {
      setIsHovering(false);
      hoverTimerRef.current = null;
    }, 200);
  }, []);

  // Clicking the image also pins the selection
  const handleClick = useCallback(() => {
    const block = Blocks.getBlock(editor, { id: blockId });
    if (block) {
      editor.setPath({ current: block.meta.order });
    }
  }, [editor, blockId]);

  // Get the original render from the theme
  const OriginalRender = ImageUI.image.render;

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <OriginalRender {...props} />
    </div>
  );
}

/**
 * Override config to pass as the second argument to `applyTheme(plugins, overrides)`.
 *
 * The `Image` key must match the Yoopta plugin type name.
 */
export const IMAGE_THEME_OVERRIDE = {
  Image: {
    elements: {
      image: {
        ...ImageUI.image,
        render: ImageRenderWrapper,
      },
    },
  },
};
