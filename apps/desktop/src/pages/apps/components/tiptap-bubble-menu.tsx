/**
 * EditorBubbleMenu
 *
 * A Notion-like floating toolbar that appears on text selection in a tiptap editor.
 * Provides inline formatting, block type conversion ("Turn Into"), link editing,
 * text color picking, and clear formatting controls.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/core";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Highlighter,
  Link as LinkIcon,
  Link2Off,
  RemoveFormatting,
  ChevronDown,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code2,
  Palette,
  Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlockTypeOption {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  action: (editor: Editor) => void;
}

interface ColorPreset {
  label: string;
  value: string;
  /** Tailwind class for the swatch preview */
  swatch: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLOCK_TYPES: BlockTypeOption[] = [
  {
    id: "paragraph",
    label: "Text",
    icon: Type,
    isActive: (editor) =>
      editor.isActive("paragraph") &&
      !editor.isActive("bulletList") &&
      !editor.isActive("orderedList") &&
      !editor.isActive("taskList"),
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    id: "heading1",
    label: "Heading 1",
    icon: Heading1,
    isActive: (editor) => editor.isActive("heading", { level: 1 }),
    action: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "heading2",
    label: "Heading 2",
    icon: Heading2,
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
    action: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "heading3",
    label: "Heading 3",
    icon: Heading3,
    isActive: (editor) => editor.isActive("heading", { level: 3 }),
    action: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "bulletList",
    label: "Bullet List",
    icon: List,
    isActive: (editor) => editor.isActive("bulletList"),
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "orderedList",
    label: "Numbered List",
    icon: ListOrdered,
    isActive: (editor) => editor.isActive("orderedList"),
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "taskList",
    label: "To-do List",
    icon: ListTodo,
    isActive: (editor) => editor.isActive("taskList"),
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "blockquote",
    label: "Quote",
    icon: Quote,
    isActive: (editor) => editor.isActive("blockquote"),
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "codeBlock",
    label: "Code Block",
    icon: Code2,
    isActive: (editor) => editor.isActive("codeBlock"),
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
];

const COLOR_PRESETS: ColorPreset[] = [
  { label: "Default", value: "", swatch: "bg-foreground" },
  { label: "Gray", value: "#9CA3AF", swatch: "bg-gray-400" },
  { label: "Brown", value: "#A16207", swatch: "bg-amber-700" },
  { label: "Red", value: "#EF4444", swatch: "bg-red-500" },
  { label: "Orange", value: "#F97316", swatch: "bg-orange-500" },
  { label: "Yellow", value: "#EAB308", swatch: "bg-yellow-500" },
  { label: "Green", value: "#22C55E", swatch: "bg-green-500" },
  { label: "Blue", value: "#3B82F6", swatch: "bg-blue-500" },
  { label: "Purple", value: "#A855F7", swatch: "bg-purple-500" },
  { label: "Pink", value: "#EC4899", swatch: "bg-pink-500" },
];

const BG_COLOR_PRESETS: ColorPreset[] = [
  { label: "Default", value: "", swatch: "bg-transparent" },
  { label: "Gray", value: "#F3F4F6", swatch: "bg-gray-100" },
  { label: "Brown", value: "#FEF3C7", swatch: "bg-amber-100" },
  { label: "Red", value: "#FEE2E2", swatch: "bg-red-100" },
  { label: "Orange", value: "#FFEDD5", swatch: "bg-orange-100" },
  { label: "Yellow", value: "#FEF9C3", swatch: "bg-yellow-100" },
  { label: "Green", value: "#DCFCE7", swatch: "bg-green-100" },
  { label: "Blue", value: "#DBEAFE", swatch: "bg-blue-100" },
  { label: "Purple", value: "#F3E8FF", swatch: "bg-purple-100" },
  { label: "Pink", value: "#FCE7F3", swatch: "bg-pink-100" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActiveBlockLabel(editor: Editor): string {
  for (const bt of BLOCK_TYPES) {
    if (bt.isActive(editor)) return bt.label;
  }
  return "Text";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Small icon-only formatting button used in the toolbar. */
function ToolbarButton({
  onClick,
  isActive = false,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center justify-center h-7 w-7 rounded-md",
        "text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        isActive && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Thin vertical separator between toolbar groups. */
function Separator() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
}

// ---------------------------------------------------------------------------
// Dropdown: Turn Into
// ---------------------------------------------------------------------------

function TurnIntoDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const activeLabel = getActiveBlockLabel(editor);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium",
          "text-muted-foreground transition-colors whitespace-nowrap",
          "hover:bg-accent hover:text-accent-foreground",
          open && "bg-accent text-accent-foreground",
        )}
        title="Turn into"
      >
        {activeLabel}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 top-full mt-1 z-[9999]",
            "w-48 rounded-lg border border-border bg-popover p-1 shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          {BLOCK_TYPES.map((bt) => {
            const Icon = bt.icon;
            const active = bt.isActive(editor);
            return (
              <button
                key={bt.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  "text-foreground transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  active && "bg-accent/60",
                )}
                onClick={() => {
                  bt.action(editor);
                  setOpen(false);
                }}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left">{bt.label}</span>
                {active && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropdown: Color Picker
// ---------------------------------------------------------------------------

function ColorPickerDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const currentColor =
    (editor.getAttributes("textStyle")?.color as string) || "";
  const currentBgColor =
    (editor.getAttributes("highlight")?.color as string) || "";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Text color"
        className={cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-md",
          "text-muted-foreground transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          open && "bg-accent text-accent-foreground",
        )}
      >
        <Palette className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1 z-[9999]",
            "w-44 rounded-lg border border-border bg-popover p-1 shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          {/* Text color section */}
          <p className="mb-1 px-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Color
          </p>
          <div className="flex flex-col">
            {COLOR_PRESETS.map((color) => {
              const isActive =
                color.value === currentColor ||
                (color.value === "" && !currentColor);
              return (
                <button
                  key={color.label}
                  type="button"
                  onClick={() => {
                    if (color.value) {
                      editor.chain().focus().setColor(color.value).run();
                    } else {
                      editor.chain().focus().unsetColor().run();
                    }
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-accent"
                >
                  <span
                    className={cn("h-3.5 w-3.5 rounded-full shrink-0", color.swatch)}
                    style={color.value ? { backgroundColor: color.value } : undefined}
                  />
                  <span>{color.label}</span>
                  {isActive && <Check className="h-3 w-3 ml-auto text-muted-foreground" />}
                </button>
              );
            })}
          </div>

          {/* Background color section */}
          <div className="my-1 h-px bg-border" />
          <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Background
          </p>
          <div className="flex flex-col">
            {BG_COLOR_PRESETS.map((color) => {
              const isActive =
                color.value === currentBgColor ||
                (color.value === "" && !currentBgColor);
              return (
                <button
                  key={`bg-${color.label}`}
                  type="button"
                  onClick={() => {
                    if (color.value) {
                      editor.chain().focus().setHighlight({ color: color.value }).run();
                    } else {
                      editor.chain().focus().unsetHighlight().run();
                    }
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-accent"
                >
                  <span
                    className={cn(
                      "h-3.5 w-3.5 rounded-full shrink-0 border border-border/50",
                      color.swatch,
                    )}
                    style={color.value ? { backgroundColor: color.value } : undefined}
                  />
                  <span>{color.label}</span>
                  {isActive && <Check className="h-3 w-3 ml-auto text-muted-foreground" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Link button with inline popover
// ---------------------------------------------------------------------------

function LinkButton({ editor }: { editor: Editor }) {
  const isActive = editor.isActive("link");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Focus input when popover opens for new link, or when editing starts
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, editing]);

  const handleOpen = useCallback(() => {
    if (isActive) {
      // Open in preview mode for existing links
      setEditing(false);
      setUrlInput("");
    } else {
      // Open in edit mode for new links
      setEditing(true);
      setUrlInput("");
    }
    setOpen(true);
  }, [isActive]);

  const handleStartEditing = useCallback(() => {
    const currentHref =
      (editor.getAttributes("link")?.href as string) || "";
    setUrlInput(currentHref);
    setEditing(true);
  }, [editor]);

  const handleApply = useCallback(() => {
    const trimmed = urlInput.trim();
    if (trimmed) {
      editor.chain().focus().setLink({ href: trimmed }).run();
    }
    setOpen(false);
    setEditing(false);
  }, [editor, urlInput]);

  const handleUnlink = useCallback(() => {
    editor.chain().focus().unsetLink().run();
    setOpen(false);
    setEditing(false);
  }, [editor]);

  // Determine what to show: edit form or link preview
  const showEditForm = !isActive || editing;

  return (
    <div ref={containerRef} className="relative">
      <ToolbarButton
        onClick={handleOpen}
        isActive={isActive || open}
        title={isActive ? "Edit link" : "Add link"}
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>

      {open && (
        <div
          className={cn(
            "absolute left-0 top-full mt-1 z-[9999]",
            "w-64 rounded-lg border border-border bg-popover p-2 shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          {showEditForm ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleApply();
              }}
              className="flex items-center gap-1"
            >
              <input
                ref={inputRef}
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter URL..."
                className={cn(
                  "flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs",
                  "outline-none focus:ring-1 focus:ring-ring",
                )}
              />
              <button
                type="submit"
                className={cn(
                  "shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground",
                  "hover:bg-primary/90",
                )}
              >
                Apply
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="truncate px-1 text-xs text-muted-foreground">
                {editor.getAttributes("link")?.href as string}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 text-xs font-medium",
                    "bg-accent text-accent-foreground hover:bg-accent/80",
                  )}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleUnlink}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                    "text-destructive hover:bg-destructive/10",
                  )}
                >
                  <Link2Off className="h-3 w-3" />
                  Unlink
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: "top",
        offset: { mainAxis: 8, crossAxis: 0 },
      }}
      shouldShow={({ editor: ed, from, to }) => {
        // Don't show in code blocks
        if (ed.isActive("codeBlock")) return false;
        // Only show when there's a text selection
        return from !== to;
      }}
      className={cn(
        "flex items-center gap-0.5",
        "rounded-lg border border-border bg-popover p-1 shadow-lg",
      )}
    >
      {/* Turn Into dropdown */}
      <TurnIntoDropdown editor={editor} />

      <Separator />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (\u2318B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (\u2318I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline (\u2318U)"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough (\u2318\u21E7S)"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Inline code (\u2318E)"
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
        title="Highlight (\u2318\u21E7H)"
      >
        <Highlighter className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator />

      {/* Link */}
      <LinkButton editor={editor} />

      {/* Color picker */}
      <ColorPickerDropdown editor={editor} />

      <Separator />

      {/* Clear formatting */}
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
        title="Clear formatting"
      >
        <RemoveFormatting className="h-3.5 w-3.5" />
      </ToolbarButton>
    </BubbleMenu>
  );
}
