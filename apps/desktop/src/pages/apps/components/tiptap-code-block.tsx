/**
 * CodeBlockWithLanguage
 *
 * A custom tiptap NodeView for CodeBlockLowlight that renders a language
 * dropdown selector in the top-right corner of code blocks on hover.
 * Replaces the CSS-only `data-language::before` label with an interactive control.
 */

import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
} from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { cn } from "@/lib/utils";

const lowlight = createLowlight(common);

/** Languages available in the dropdown, sorted for convenience. */
const LANGUAGES = [
  { value: "", label: "Plain text" },
  { value: "bash", label: "Bash" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "css", label: "CSS" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "go", label: "Go" },
  { value: "graphql", label: "GraphQL" },
  { value: "html", label: "HTML" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "kotlin", label: "Kotlin" },
  { value: "lua", label: "Lua" },
  { value: "markdown", label: "Markdown" },
  { value: "perl", label: "Perl" },
  { value: "php", label: "PHP" },
  { value: "python", label: "Python" },
  { value: "r", label: "R" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "scala", label: "Scala" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "typescript", label: "TypeScript" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
] as const;

function CodeBlockComponent({ node, updateAttributes }: NodeViewProps) {
  const language = (node.attrs.language as string) || "";

  return (
    <NodeViewWrapper className="code-block-wrapper relative group">
      <div
        contentEditable={false}
        className={cn(
          "absolute right-2 top-2 z-10",
          "opacity-0 group-hover:opacity-100 transition-opacity",
        )}
      >
        <select
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          className={cn(
            "rounded-md border border-neutral-700 bg-neutral-800 px-2 py-0.5",
            "text-xs text-neutral-300 outline-none",
            "hover:border-neutral-600 focus:border-neutral-500",
            "cursor-pointer",
          )}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
      <pre data-language={language || undefined}>
        <NodeViewContent as={"code" as any} />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlockWithLanguage = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
});

export { lowlight };
