"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-loaded Streamdown with code highlighting plugins.
 *
 * Both `streamdown` (~heavy markdown renderer) and `@streamdown/code`
 * (syntax highlighting) are only loaded when a message actually contains
 * markdown content that needs rendering.
 */
export const LazyStreamdown = dynamic(
  () =>
    Promise.all([
      import("streamdown"),
      import("@/lib/streamdown-config"),
    ]).then(([streamdownMod, configMod]) => {
      const StreamdownComp = streamdownMod.Streamdown;
      const plugins = configMod.streamdownPlugins;

      const Wrapped = (
        props: React.ComponentProps<typeof StreamdownComp>,
      ) => <StreamdownComp {...props} plugins={plugins} />;
      Wrapped.displayName = "LazyStreamdown";

      return { default: Wrapped };
    }),
  { ssr: false },
);
