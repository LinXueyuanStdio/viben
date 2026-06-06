import * as React from "react";
import type { EmojiPickerProps } from "./emoji-picker";

const LazyEmojiPickerImpl = React.lazy(async () => {
  const module = await import("./emoji-picker");
  return { default: module.EmojiPicker };
});

export function EmojiPicker(props: EmojiPickerProps) {
  return (
    <React.Suspense fallback={null}>
      <LazyEmojiPickerImpl {...props} />
    </React.Suspense>
  );
}

export type { EmojiPickerProps };
