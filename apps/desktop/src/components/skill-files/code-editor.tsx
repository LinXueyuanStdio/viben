import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CodeEditorProps } from "./code-editor-impl";

// Re-export types for backward compatibility
export type { CodeEditorProps } from "./code-editor-impl";

/**
 * Loading fallback component for Monaco Editor
 */
function EditorLoadingFallback({ height = "100%" }: { height?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center" style={{ height, minHeight: "200px" }}>
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">{t("common.loading")}</p>
      </div>
    </div>
  );
}

// Lazy load the CodeEditor implementation to split Monaco Editor into a separate chunk
// This dynamic import ensures Monaco Editor is only loaded when the CodeEditor component is actually used
const LazyCodeEditorImpl = lazy(() =>
  import("./code-editor-impl").then((m) => ({ default: m.CodeEditorImpl }))
);

/**
 * CodeEditor component with lazy loading
 * Monaco Editor is loaded on-demand to improve initial bundle size
 */
export function CodeEditor(props: CodeEditorProps) {
  return (
    <Suspense fallback={<EditorLoadingFallback height={props.height} />}>
      <LazyCodeEditorImpl {...props} />
    </Suspense>
  );
}

export default CodeEditor;
