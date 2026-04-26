/**
 * EditorSlashMenu
 *
 * A Notion-like slash command palette for tiptap editors.
 * Triggered by typing "/" at any cursor position.
 * Supports real-time filtering, keyboard navigation, and categorized commands.
 */

import { useState, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Editor } from "@tiptap/react";
import {
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code2,
  Minus,
  ChevronRight,
  ImageIcon,
  Table as TableIcon,
  Sigma,
  Video,
  Lightbulb,
  Music,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlashCommand {
  icon: LucideIcon;
  label: string;
  description: string;
  action: (editor: Editor) => void;
  /** If set, this command needs an inline input instead of immediate execution */
  requiresInput?: "image" | "youtube" | "audio";
}

interface SlashCommandCategory {
  name: string;
  commands: SlashCommand[];
}

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

const COMMAND_CATEGORIES: SlashCommandCategory[] = [
  {
    name: "Basic Blocks",
    commands: [
      {
        icon: Pilcrow,
        label: "Text",
        description: "Plain text block",
        action: (editor) => editor.chain().focus().setParagraph().run(),
      },
      {
        icon: Heading1,
        label: "Heading 1",
        description: "Large section heading",
        action: (editor) =>
          editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        icon: Heading2,
        label: "Heading 2",
        description: "Medium section heading",
        action: (editor) =>
          editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        icon: Heading3,
        label: "Heading 3",
        description: "Small section heading",
        action: (editor) =>
          editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
    ],
  },
  {
    name: "Lists",
    commands: [
      {
        icon: List,
        label: "Bullet List",
        description: "Simple bullet list",
        action: (editor) => editor.chain().focus().toggleBulletList().run(),
      },
      {
        icon: ListOrdered,
        label: "Numbered List",
        description: "Numbered list",
        action: (editor) => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        icon: ListTodo,
        label: "To-do List",
        description: "Track tasks with checkboxes",
        action: (editor) => editor.chain().focus().toggleTaskList().run(),
      },
    ],
  },
  {
    name: "Advanced Blocks",
    commands: [
      {
        icon: Quote,
        label: "Quote",
        description: "Capture a quote",
        action: (editor) => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        icon: Code2,
        label: "Code Block",
        description: "Code with syntax highlighting",
        action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
      },
      {
        icon: Minus,
        label: "Divider",
        description: "Visual separator",
        action: (editor) => editor.chain().focus().setHorizontalRule().run(),
      },
      {
        icon: ChevronRight,
        label: "Toggle",
        description: "Collapsible toggle block",
        action: (editor) => editor.chain().focus().setDetails().run(),
      },
      {
        icon: Lightbulb,
        label: "Callout",
        description: "Highlighted callout block",
        action: (editor) =>
          editor
            .chain()
            .focus()
            .insertContent({
              type: "callout",
              attrs: { type: "default", emoji: "\u{1F4A1}" },
              content: [{ type: "paragraph" }],
            })
            .run(),
      },
      {
        icon: TableIcon,
        label: "Table",
        description: "Add a simple table",
        action: (editor) =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
      },
      {
        icon: Sigma,
        label: "Math Equation",
        description: "Insert LaTeX math block",
        action: (editor) =>
          editor
            .chain()
            .focus()
            .insertBlockMath({ latex: "E = mc^2" })
            .run(),
      },
      {
        icon: Sigma,
        label: "Inline Math",
        description: "Insert inline LaTeX expression",
        action: (editor) =>
          editor
            .chain()
            .focus()
            .insertInlineMath({ latex: "x^2" })
            .run(),
      },
    ],
  },
  {
    name: "Embeds",
    commands: [
      {
        icon: ImageIcon,
        label: "Image",
        description: "Embed an image from URL",
        requiresInput: "image",
        action: () => {
          // Handled by the inline URL input in the slash menu component
        },
      },
      {
        icon: Music,
        label: "Audio",
        description: "Embed an audio file",
        requiresInput: "audio",
        action: () => {
          // Handled by the inline URL input in the slash menu component
        },
      },
      {
        icon: Video,
        label: "YouTube Video",
        description: "Embed a YouTube video",
        requiresInput: "youtube",
        action: () => {
          // Handled by the inline URL input in the slash menu component
        },
      },
    ],
  },
];

// Filter categories, keeping only commands that match the query.
// Returns categories that have at least one matching command.
function filterCategories(query: string): SlashCommandCategory[] {
  if (!query) return COMMAND_CATEGORIES;

  const lower = query.toLowerCase();
  return COMMAND_CATEGORIES.map((cat) => ({
    ...cat,
    commands: cat.commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.description.toLowerCase().includes(lower),
    ),
  })).filter((cat) => cat.commands.length > 0);
}

// Collect a flat list of commands from filtered categories (preserves display order)
function flattenFiltered(categories: SlashCommandCategory[]): SlashCommand[] {
  return categories.flatMap((cat) => cat.commands);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorSlashMenu({ editor }: { editor: Editor }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });

  // Inline URL input state (shared by image and YouTube commands)
  const [inputMode, setInputMode] = useState<"image" | "youtube" | "audio" | null>(null);
  const [inputUrl, setInputUrl] = useState("");
  const urlInputRef = useRef<HTMLInputElement>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const filteredCategories = filterCategories(filterText);
  const flatItems = flattenFiltered(filteredCategories);

  // Reset selection when filter text changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filterText]);

  // Scroll selected item into view
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Compute menu position from the editor cursor coordinates
  const updateMenuPosition = useCallback(() => {
    if (!editor.view) return;
    try {
      const coords = editor.view.coordsAtPos(editor.state.selection.from);
      setMenuPosition({ top: coords.bottom + 6, left: coords.left });
    } catch {
      // coordsAtPos can throw if the view is not ready
    }
  }, [editor]);

  // Delete the slash trigger text ("/" + filter) from the document
  const deleteSlashText = useCallback(() => {
    const { $from } = editor.state.selection;
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
    const slashIndex = textBefore.lastIndexOf("/");

    if (slashIndex >= 0) {
      const deleteFrom = $from.pos - (textBefore.length - slashIndex);
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.delete(deleteFrom, $from.pos);
          return true;
        })
        .run();
    }
  }, [editor]);

  // Delete the slash trigger text, then run the command
  const executeCommand = useCallback(
    (command: SlashCommand) => {
      // If the command requires an inline input, switch to input mode
      if (command.requiresInput) {
        setInputMode(command.requiresInput);
        setInputUrl("");
        // Focus the input after it renders
        requestAnimationFrame(() => {
          urlInputRef.current?.focus();
        });
        return;
      }

      deleteSlashText();
      command.action(editor);
      setIsOpen(false);
      setFilterText("");
      setSelectedIndex(0);
    },
    [editor, deleteSlashText],
  );

  // Submit URL: delete slash text, insert content based on mode, close menu
  const submitUrl = useCallback(
    (url: string) => {
      if (!url.trim()) return;
      deleteSlashText();
      if (inputMode === "youtube") {
        editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
      } else if (inputMode === "audio") {
        editor.chain().focus().setAudio({ src: url.trim() }).run();
      } else {
        editor.chain().focus().setImage({ src: url.trim() }).run();
      }
      setIsOpen(false);
      setFilterText("");
      setSelectedIndex(0);
      setInputMode(null);
      setInputUrl("");
    },
    [editor, deleteSlashText, inputMode],
  );

  // Close the menu and clean up state
  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setFilterText("");
    setSelectedIndex(0);
    setInputMode(null);
    setInputUrl("");
  }, []);

  // ---------------------------------------------------------------------------
  // Event listeners
  // ---------------------------------------------------------------------------

  // Listen for the "/" trigger on keydown
  useEffect(() => {
    if (!editor?.view) return;

    const dom = editor.view.dom;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !isOpen) {
        // Delay opening slightly so the "/" character is inserted first
        requestAnimationFrame(() => {
          setIsOpen(true);
          setFilterText("");
          setSelectedIndex(0);
          updateMenuPosition();
        });
      }
    };

    dom.addEventListener("keydown", handleKeyDown);
    return () => dom.removeEventListener("keydown", handleKeyDown);
  }, [editor, isOpen, updateMenuPosition]);

  // When menu is open, intercept keyboard navigation and track filter text
  // Skip when URL input is shown (keys go to the input element instead)
  useEffect(() => {
    if (!editor?.view || !isOpen || inputMode) return;

    const dom = editor.view.dom;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev < flatItems.length - 1 ? prev + 1 : 0,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : flatItems.length - 1,
        );
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (flatItems.length > 0 && selectedIndex < flatItems.length) {
          executeCommand(flatItems[selectedIndex]);
        }
        return;
      }
    };

    dom.addEventListener("keydown", handleKeyDown, true);
    return () => dom.removeEventListener("keydown", handleKeyDown, true);
  }, [editor, isOpen, inputMode, flatItems, selectedIndex, executeCommand, closeMenu]);

  // Track editor updates to maintain filter text in sync with the document
  useEffect(() => {
    if (!editor || !isOpen) return;

    const handleUpdate = () => {
      const { $from } = editor.state.selection;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
      const slashIndex = textBefore.lastIndexOf("/");

      if (slashIndex >= 0) {
        setFilterText(textBefore.slice(slashIndex + 1));
        updateMenuPosition();
      } else {
        // The "/" was deleted or cursor moved away
        closeMenu();
      }
    };

    editor.on("update", handleUpdate);
    editor.on("selectionUpdate", handleUpdate);

    return () => {
      editor.off("update", handleUpdate);
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor, isOpen, updateMenuPosition, closeMenu]);

  // Close on click outside the menu
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    // Use capture phase so we detect clicks before tiptap processes them
    document.addEventListener("mousedown", handleClickOutside, true);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside, true);
  }, [isOpen, closeMenu]);

  // Close on editor blur
  useEffect(() => {
    if (!editor?.view || !isOpen) return;

    const handleBlur = () => {
      // Small delay to allow click events on menu items to fire first
      setTimeout(() => {
        if (
          menuRef.current &&
          !menuRef.current.contains(document.activeElement)
        ) {
          closeMenu();
        }
      }, 150);
    };

    editor.on("blur", handleBlur);
    return () => {
      editor.off("blur", handleBlur);
    };
  }, [editor, isOpen, closeMenu]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isOpen) return null;

  // Track the running index across categories for keyboard navigation
  let runningIndex = 0;

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 w-[280px] max-h-[320px] overflow-y-auto",
        "rounded-lg border border-border bg-popover shadow-md",
        "animate-in fade-in-0 slide-in-from-top-1 duration-150",
      )}
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
      }}
    >
      {inputMode ? (
        /* ---------- Inline URL input (image / youtube) ---------- */
        <div className="p-2">
          <div className="flex items-center gap-2 px-1 pb-2">
            {inputMode === "youtube" ? (
              <Video className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : inputMode === "audio" ? (
              <Music className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground">
              {inputMode === "youtube" ? "Embed YouTube Video" : inputMode === "audio" ? "Embed Audio" : "Insert Image"}
            </span>
          </div>
          <input
            ref={urlInputRef}
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitUrl(inputUrl);
              } else if (e.key === "Escape") {
                e.preventDefault();
                // Go back to command list
                setInputMode(null);
                setInputUrl("");
              }
            }}
            placeholder={
              inputMode === "youtube"
                ? "Paste YouTube URL and press Enter..."
                : inputMode === "audio"
                  ? "Paste audio URL and press Enter..."
                  : "Paste image URL and press Enter..."
            }
            className={cn(
              "w-full rounded-md border border-border bg-background px-3 py-2",
              "text-sm text-foreground placeholder:text-muted-foreground",
              "outline-none focus:ring-1 focus:ring-ring",
            )}
          />
          <div className="mt-1.5 flex items-center gap-2 px-1 text-[11px] text-muted-foreground/70">
            <span>Enter to insert</span>
            <span>Esc to cancel</span>
          </div>
        </div>
      ) : flatItems.length === 0 ? (
        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
          No results
        </div>
      ) : (
        <div className="p-1">
          {filterText && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border mb-1">
              <span className="text-muted-foreground/70">Filter: </span>
              <span className="font-medium">{filterText}</span>
            </div>
          )}
          {filteredCategories.map((category) => {
            const categoryStartIndex = runningIndex;
            const categoryItems = category.commands.map((cmd, cmdIdx) => {
              const itemIndex = categoryStartIndex + cmdIdx;
              const isSelected = itemIndex === selectedIndex;
              const Icon = cmd.icon;

              const button = (
                <button
                  key={cmd.label}
                  ref={isSelected ? selectedItemRef : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm",
                    "text-foreground transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent text-accent-foreground",
                  )}
                  onMouseEnter={() => setSelectedIndex(itemIndex)}
                  onMouseDown={(e) => {
                    // Prevent editor from losing focus
                    e.preventDefault();
                  }}
                  onClick={() => executeCommand(cmd)}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-0">
                    <span className="font-medium leading-tight">
                      {cmd.label}
                    </span>
                    <span className="text-xs leading-tight text-muted-foreground">
                      {cmd.description}
                    </span>
                  </div>
                </button>
              );

              return button;
            });

            runningIndex += category.commands.length;

            return (
              <div key={category.name}>
                <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {category.name}
                </div>
                {categoryItems}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
