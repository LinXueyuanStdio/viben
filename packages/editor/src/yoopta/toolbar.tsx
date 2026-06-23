import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDownIcon,
  CodeIcon,
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  Unlink2Icon,
  SigmaIcon,
  Strikethrough,
  Underline,
  HighlighterIcon,
  BaselineIcon,
} from "lucide-react";
import { Blocks, Marks, useYooptaEditor } from "@yoopta/editor";
import { MathInlineCommands } from "@yoopta/math";
// @ts-ignore - LinkCommands is exported from @yoopta/link
import { LinkCommands } from "@yoopta/link";
import { Editor, Element as SlateElement, Range } from "slate";
import { FloatingToolbar } from "@yoopta/ui/floating-toolbar";
import { HighlightColorPicker } from "@yoopta/ui/highlight-color-picker";
import { YooptaActionMenuList } from "./action-menu";
import { MOD_KEY } from "./constants";

export const YooptaToolbar = () => {
  const { t } = useTranslation();
  const editor = useYooptaEditor();
  const turnIntoRef = useRef<HTMLButtonElement>(null);
  const linkButtonRef = useRef<HTMLButtonElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkPopoverRef = useRef<HTMLDivElement>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const mod = MOD_KEY;

  const highlightValue = Marks.getValue(editor, { type: "highlight" }) as
    | { color?: string; backgroundColor?: string }
    | null;

  const getCurrentSlate = useCallback(() => {
    if (editor.path.current === null) return null;
    const currentBlockId = Object.keys(editor.children).find(
      (id) => editor.children[id]?.meta.order === editor.path.current,
    );
    if (!currentBlockId) return null;
    return Blocks.getBlockSlate(editor, { id: currentBlockId });
  }, [editor]);

  const isLinkActive = useCallback(() => {
    const slate = getCurrentSlate();
    if (!slate || !slate.selection) return false;
    const [link] = Editor.nodes(slate, {
      match: (n: unknown) =>
        !Editor.isEditor(n as Editor) &&
        SlateElement.isElement(n) &&
        (n as { type?: string }).type === "link",
    });
    return !!link;
  }, [getCurrentSlate]);

  const onTurnIntoClick = () => {
    setActionMenuOpen(true);
  };

  const getActiveLinkUrl = useCallback(() => {
    const slate = getCurrentSlate();
    if (!slate || !slate.selection) return "";
    const [linkEntry] = Editor.nodes(slate, {
      match: (n: unknown) =>
        !Editor.isEditor(n as Editor) &&
        SlateElement.isElement(n) &&
        (n as { type?: string }).type === "link",
    });
    if (!linkEntry) return "";
    const linkNode = linkEntry[0] as { props?: { url?: string } };
    return linkNode.props?.url || "";
  }, [getCurrentSlate]);

  const onLinkClick = useCallback(() => {
    const slate = getCurrentSlate();
    if (!slate || !slate.selection) return;

    // If link already active, populate with existing URL for editing
    if (isLinkActive()) {
      const existingUrl = getActiveLinkUrl();
      setLinkUrl(existingUrl);
    } else {
      setLinkUrl("");
    }

    setLinkPopoverOpen(true);
    setTimeout(() => linkInputRef.current?.focus(), 0);
  }, [editor, getCurrentSlate, isLinkActive, getActiveLinkUrl]);

  const onLinkApply = () => {
    const slate = getCurrentSlate();
    if (!slate || !slate.selection) {
      setLinkPopoverOpen(false);
      return;
    }

    // Empty URL = remove existing link
    if (!linkUrl.trim()) {
      if (isLinkActive()) {
        LinkCommands.deleteLink(editor, { slate });
      }
      setLinkPopoverOpen(false);
      setLinkUrl("");
      return;
    }

    // Remove existing link before inserting updated one
    if (isLinkActive()) {
      LinkCommands.deleteLink(editor, { slate });
    }

    const selectedText = !Range.isCollapsed(slate.selection)
      ? Editor.string(slate, slate.selection)
      : "";

    LinkCommands.insertLink(editor, {
      slate,
      props: {
        url: linkUrl.trim(),
        title: selectedText || linkUrl.trim(),
        target: "_blank",
        rel: "noopener noreferrer",
      },
    });

    setLinkPopoverOpen(false);
    setLinkUrl("");
  };

  const onInsertMath = () => {
    if (editor.path.current === null) return;

    const currentBlockId = Object.keys(editor.children).find((id) => {
      return editor.children[id]?.meta.order === editor.path.current;
    });
    if (!currentBlockId) return;

    const slate = Blocks.getBlockSlate(editor, { id: currentBlockId });
    if (!slate || !slate.selection) return;

    const selectedText = !Range.isCollapsed(slate.selection)
      ? Editor.string(slate, slate.selection)
      : "";

    MathInlineCommands.insertMathInline(
      editor,
      selectedText || "E = mc^2",
      { slate }
    );
  };

  // Click-outside handler for link popover
  useEffect(() => {
    if (!linkPopoverOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        linkPopoverRef.current &&
        !linkPopoverRef.current.contains(e.target as Node) &&
        linkButtonRef.current &&
        !linkButtonRef.current.contains(e.target as Node)
      ) {
        setLinkPopoverOpen(false);
        setLinkUrl("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [linkPopoverOpen]);

  // Register Cmd+K / Ctrl+K keyboard shortcut for link insertion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (editor.path.current === null) return;
        e.preventDefault();
        onLinkClick();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, onLinkClick]);

  return (
    <>
      <FloatingToolbar frozen={actionMenuOpen || linkPopoverOpen}>
        <FloatingToolbar.Content>
          <FloatingToolbar.Group>
            <FloatingToolbar.Button ref={turnIntoRef} onClick={onTurnIntoClick}>
              {t("editor.toolbar.turnInto", "Turn into")}
              <ChevronDownIcon width={16} height={16} />
            </FloatingToolbar.Button>
          </FloatingToolbar.Group>
          <FloatingToolbar.Separator />
          <FloatingToolbar.Group>
            {editor.formats.bold && (
              <FloatingToolbar.Button
                onClick={() => Marks.toggle(editor, { type: "bold" })}
                active={Marks.isActive(editor, { type: "bold" })}
                title={t("editor.toolbar.bold", { shortcut: `${mod}+B` })}
              >
                <BoldIcon />
              </FloatingToolbar.Button>
            )}
            {editor.formats.italic && (
              <FloatingToolbar.Button
                onClick={() => Marks.toggle(editor, { type: "italic" })}
                active={Marks.isActive(editor, { type: "italic" })}
                title={t("editor.toolbar.italic", { shortcut: `${mod}+I` })}
              >
                <ItalicIcon />
              </FloatingToolbar.Button>
            )}
            {editor.formats.underline && (
              <FloatingToolbar.Button
                onClick={() => Marks.toggle(editor, { type: "underline" })}
                active={Marks.isActive(editor, { type: "underline" })}
                title={t("editor.toolbar.underline", { shortcut: `${mod}+U` })}
              >
                <Underline />
              </FloatingToolbar.Button>
            )}
            {editor.formats.strike && (
              <FloatingToolbar.Button
                onClick={() => Marks.toggle(editor, { type: "strike" })}
                active={Marks.isActive(editor, { type: "strike" })}
                title={t("editor.toolbar.strikethrough", { shortcut: `${mod}+Shift+S` })}
              >
                <Strikethrough />
              </FloatingToolbar.Button>
            )}
            {editor.formats.code && (
              <FloatingToolbar.Button
                onClick={() => Marks.toggle(editor, { type: "code" })}
                active={Marks.isActive(editor, { type: "code" })}
                title={t("editor.toolbar.code", { shortcut: `${mod}+E` })}
              >
                <CodeIcon />
              </FloatingToolbar.Button>
            )}
            <div style={{ position: "relative" }}>
              <FloatingToolbar.Button
                ref={linkButtonRef}
                onClick={onLinkClick}
                active={isLinkActive()}
                title={t("editor.toolbar.link", { shortcut: `${mod}+K` })}
              >
                <LinkIcon />
              </FloatingToolbar.Button>
              {linkPopoverOpen && (
                <div
                  ref={linkPopoverRef}
                  role="dialog"
                  aria-label={t("editor.toolbar.insertLink", "Insert link")}
                  className="yoopta-link-popover"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 6px",
                    background: "var(--popover, #fff)",
                    border: "1px solid var(--border, #e2e2e2)",
                    borderRadius: 6,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                    zIndex: 999,
                    whiteSpace: "nowrap",
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <input
                    ref={linkInputRef}
                    type="text"
                    aria-label={t("editor.toolbar.linkUrl", "Link URL")}
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onLinkApply();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setLinkPopoverOpen(false);
                        setLinkUrl("");
                      }
                    }}
                    style={{
                      border: "1px solid var(--border, #e2e2e2)",
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 13,
                      width: 200,
                      outline: "none",
                      background: "var(--input, transparent)",
                      color: "var(--foreground, inherit)",
                    }}
                  />
                  <button
                    onClick={onLinkApply}
                    aria-label={t("editor.toolbar.apply", "Apply")}
                    style={{
                      border: "1px solid var(--border, #e2e2e2)",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 13,
                      cursor: "pointer",
                      background: "var(--primary, #0066cc)",
                      color: "var(--primary-foreground, #fff)",
                    }}
                  >
                    {t("editor.toolbar.apply", "Apply")}
                  </button>
                  {isLinkActive() && (
                    <button
                      onClick={() => {
                        const slate = getCurrentSlate();
                        if (slate) LinkCommands.deleteLink(editor, { slate });
                        setLinkPopoverOpen(false);
                        setLinkUrl("");
                      }}
                      aria-label={t("editor.toolbar.removeLink", "Remove link")}
                      title={t("editor.toolbar.removeLink", "Remove link")}
                      style={{
                        border: "1px solid var(--border, #e2e2e2)",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontSize: 13,
                        cursor: "pointer",
                        background: "transparent",
                        color: "var(--destructive, #e53e3e)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Unlink2Icon width={14} height={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {editor.formats.highlight && (
              <HighlightColorPicker
                value={{ color: highlightValue?.color }}
                presets={[
                  "currentColor",
                  "#787774",
                  "#9F6B53",
                  "#D9730D",
                  "#CB912F",
                  "#448361",
                  "#337EA9",
                  "#9065B0",
                  "#C14C8A",
                  "#D44C47",
                ]}
                onChange={(values) => {
                  const newColor = values.color === "currentColor" ? undefined : values.color;
                  Marks.add(editor, {
                    type: "highlight",
                    value: {
                      ...highlightValue,
                      color: newColor,
                    },
                  });
                }}
              >
                <FloatingToolbar.Button
                  active={!!highlightValue?.color}
                  title={t("editor.toolbar.textColor", "Text color")}
                >
                  <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <BaselineIcon />
                    <span
                      style={{
                        position: "absolute",
                        bottom: -2,
                        left: 0,
                        right: 0,
                        height: 3,
                        borderRadius: 1,
                        backgroundColor: highlightValue?.color || "currentColor",
                      }}
                    />
                  </span>
                </FloatingToolbar.Button>
              </HighlightColorPicker>
            )}
            {editor.formats.highlight && (
              <HighlightColorPicker
                value={{ backgroundColor: highlightValue?.backgroundColor }}
                presets={[
                  "transparent",
                  "#F1F1EF",
                  "#F4EEEE",
                  "#FBECDD",
                  "#FBF3DB",
                  "#EDF3EC",
                  "#E7F3F8",
                  "#F3E8F8",
                  "#F9E8ED",
                  "#FDEBEC",
                ]}
                onChange={(values) => {
                  const newBg = values.backgroundColor === "transparent" ? undefined : values.backgroundColor;
                  Marks.add(editor, {
                    type: "highlight",
                    value: {
                      ...highlightValue,
                      backgroundColor: newBg,
                    },
                  });
                }}
              >
                <FloatingToolbar.Button
                  active={!!highlightValue?.backgroundColor}
                  title={t("editor.toolbar.highlight", "Highlight")}
                  style={{
                    backgroundColor: highlightValue?.backgroundColor || undefined,
                  }}
                >
                  <HighlighterIcon />
                </FloatingToolbar.Button>
              </HighlightColorPicker>
            )}
          </FloatingToolbar.Group>
          {editor.plugins.MathInline && (
            <>
              <FloatingToolbar.Separator />
              <FloatingToolbar.Group>
                <FloatingToolbar.Button
                  onClick={onInsertMath}
                  title={t("editor.toolbar.insertInlineMath", "Insert inline math")}
                >
                  <SigmaIcon />
                </FloatingToolbar.Button>
              </FloatingToolbar.Group>
            </>
          )}
        </FloatingToolbar.Content>
      </FloatingToolbar>

      <YooptaActionMenuList
        open={actionMenuOpen}
        onOpenChange={setActionMenuOpen}
        anchor={turnIntoRef.current}
        placement="bottom-start"
      />
    </>
  );
};
