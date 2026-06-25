import { Blocks, Marks, type YooEditor } from "@yoopta/editor";
import { Transforms } from "slate";

import { ensureBlockFocus } from "./focus-utils";
import { handleYooptaVerticalNavigation } from "./keyboard-navigation";

const CJK_SLASH_CHARS = new Set(["／", "\uFF0F", "、", "\u3001"]);

export function findBlockIdAtOrder(editor: YooEditor, order: number): string | null {
  return Object.keys(editor.children).find((id) => editor.children[id]?.meta.order === order) ?? null;
}

export function findLastBlockId(editor: YooEditor): string | null {
  let lastBlockId: string | null = null;
  let maxOrder = -1;

  for (const id of Object.keys(editor.children)) {
    const order = editor.children[id]?.meta.order ?? -1;
    if (order > maxOrder) {
      maxOrder = order;
      lastBlockId = id;
    }
  }

  return lastBlockId;
}

export function getPlainBlockText(editor: YooEditor, blockId: string): string {
  const slate = Blocks.getBlockSlate(editor, { id: blockId });
  if (!slate?.children) return "";

  return (slate.children as any[])
    .map((node: any) => node.children?.map((child: any) => child.text || "").join("") || "")
    .join("");
}

export function focusOrCreateParagraph(editor: YooEditor): string | null {
  const blockIds = Object.keys(editor.children);
  if (blockIds.length === 0) {
    const newId = editor.insertBlock("Paragraph");
    if (newId) ensureBlockFocus(editor, newId);
    return newId ?? null;
  }

  const lastBlockId = findLastBlockId(editor);
  if (!lastBlockId) return null;

  const lastBlock = Blocks.getBlock(editor, { id: lastBlockId });
  if (!lastBlock) return null;

  const isEmptyParagraph =
    lastBlock.type === "Paragraph" && getPlainBlockText(editor, lastBlockId).trim() === "";

  if (isEmptyParagraph) {
    ensureBlockFocus(editor, lastBlockId);
    return lastBlockId;
  }

  const newId = editor.insertBlock("Paragraph", {
    at: (lastBlock.meta.order ?? blockIds.length - 1) + 1,
  });
  if (newId) ensureBlockFocus(editor, newId);
  return newId ?? null;
}

export function createYooptaKeyDownHandler(editor: YooEditor) {
  const blockTypeMap: Record<string, string> = {
    "0": "Paragraph",
    "1": "HeadingOne",
    "2": "HeadingTwo",
    "3": "HeadingThree",
    "4": "TodoList",
    "5": "BulletedList",
    "6": "NumberedList",
  };

  return (event: KeyboardEvent): boolean => {
    if (!isInsideEditor(editor, event.target)) return false;

    if (handleYooptaVerticalNavigation(editor, event)) return true;

    if (event.key === "Escape") {
      try {
        (document.activeElement as HTMLElement | null)?.blur();
      } catch {
        // Ignore blur errors from detached active elements.
      }
      return false;
    }

    const isMod = event.metaKey || event.ctrlKey;

    if (isMod && !event.shiftKey && event.key === "/") {
      event.preventDefault();
      dispatchSlashKeyEvent(editor, event.key);
      return true;
    }

    if (isMod && !event.shiftKey && event.key === "Enter") {
      if (editor.path.current === null) return false;
      const currentBlockId = findBlockIdAtOrder(editor, editor.path.current);
      if (!currentBlockId) return false;
      const block = Blocks.getBlock(editor, { id: currentBlockId });
      if (!block || block.type !== "TodoList") return false;
      const slate = Blocks.getBlockSlate(editor, { id: currentBlockId });
      const element = slate?.children?.[0] as any;
      if (!slate || element?.props?.checked === undefined) return false;

      event.preventDefault();
      Transforms.setNodes(
        slate,
        { props: { ...element.props, checked: !element.props.checked } } as any,
        { at: [0] },
      );
      return true;
    }

    if (isMod && !event.shiftKey && event.code === "KeyD") {
      if (editor.path.current === null) return false;
      event.preventDefault();
      editor.duplicateBlock({ focus: true });
      return true;
    }

    if (isMod && !event.shiftKey && event.key === "Backspace") {
      if (editor.path.current === null || Object.keys(editor.children).length <= 1) return false;
      event.preventDefault();
      editor.deleteBlock({ focusTarget: "previous" });
      return true;
    }

    if (!isMod || !event.shiftKey) return false;

    const blockType = blockTypeMap[event.key];
    if (blockType) {
      if (editor.path.current === null) return false;
      event.preventDefault();
      Blocks.toggleBlock(editor, blockType, {
        at: editor.path.current,
        focus: true,
      });
      return true;
    }

    if (event.code === "KeyH") {
      if (editor.path.current === null) return false;
      event.preventDefault();
      Marks.toggle(editor, { type: "highlight" });
      return true;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (editor.path.current === null) return false;
      event.preventDefault();

      const currentOrder = editor.path.current;
      const currentBlockId = findBlockIdAtOrder(editor, currentOrder);
      if (!currentBlockId) return false;

      if (event.key === "ArrowUp") {
        if (currentOrder <= 0) return true;
        Blocks.moveBlock(editor, currentBlockId, currentOrder - 1);
        return true;
      }

      const totalBlocks = Object.keys(editor.children).length;
      if (currentOrder >= totalBlocks - 1) return true;
      Blocks.moveBlock(editor, currentBlockId, currentOrder + 2);
      return true;
    }

    return false;
  };
}

export function createCjkSlashInputHandler(editor: YooEditor): (event: Event) => void {
  return (event: Event) => {
    if (!isInsideEditor(editor, event.target)) return;
    const data = (event as InputEvent).data ?? (event as CompositionEvent).data;
    if (!isCjkSlash(data)) return;
    tryConvertFullWidthSlash(editor);
  };
}

export function tryConvertFullWidthSlash(editor: YooEditor) {
  if (editor.path.current === null) return;
  const currentBlockId = findBlockIdAtOrder(editor, editor.path.current);
  if (!currentBlockId) return;
  const slate = Blocks.getBlockSlate(editor, { id: currentBlockId });
  if (!slate?.selection) return;

  const blockText = getPlainBlockText(editor, currentBlockId);
  const trimmed = blockText.trim();
  if (trimmed.length !== 1 || !isCjkSlash(trimmed)) return;

  Transforms.delete(slate, {
    at: {
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: blockText.length },
    },
  });

  setTimeout(() => dispatchSlashKeyEvent(editor), 0);
}

function dispatchSlashKeyEvent(editor: YooEditor, key = "/") {
  const target =
    document.activeElement?.closest("[contenteditable]") ??
    editor.refElement?.querySelector("[contenteditable]");
  if (!target) return;

  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      code: "Slash",
      keyCode: 191,
      which: 191,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
}

function isInsideEditor(editor: YooEditor, target: EventTarget | null): boolean {
  if (!target || !(target instanceof Node)) return false;
  return editor.refElement ? editor.refElement.contains(target) : false;
}

function isCjkSlash(char: string | null | undefined): boolean {
  return char != null && CJK_SLASH_CHARS.has(char);
}
