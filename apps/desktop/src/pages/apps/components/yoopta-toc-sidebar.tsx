import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Blocks, useYooptaEditor } from "@yoopta/editor";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: 1 | 2 | 3;
  order: number;
}

export function YooptaTocSidebar({ className }: { className?: string }) {
  const { t } = useTranslation();
  const editor = useYooptaEditor();
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Extract headings from editor content
  const extractHeadings = useCallback(() => {
    const headings: TocItem[] = [];
    const children = editor.children;
    if (!children) return headings;

    for (const [blockId, block] of Object.entries(children)) {
      if (!block) continue;
      const { type } = block;
      let level: 1 | 2 | 3 | null = null;
      if (type === "HeadingOne") level = 1;
      else if (type === "HeadingTwo") level = 2;
      else if (type === "HeadingThree") level = 3;
      if (level === null) continue;

      // Extract text from block value
      const text = block.value
        ?.map((el: any) =>
          el?.children?.map((child: any) => child.text || "").join("") || ""
        )
        .join("") || "";

      if (text.trim()) {
        headings.push({
          id: blockId,
          text: text.trim(),
          level,
          order: block.meta.order,
        });
      }
    }

    headings.sort((a, b) => a.order - b.order);
    return headings;
  }, [editor]);

  // Update headings on editor changes (debounced to avoid per-keystroke work)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const next = extractHeadings();
      setItems(prev => {
        if (prev.length !== next.length) return next;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].id !== next[i].id || prev[i].text !== next[i].text ||
              prev[i].level !== next[i].level || prev[i].order !== next[i].order) {
            return next;
          }
        }
        return prev; // same reference → skip IntersectionObserver rebuild
      });
    };
    // Initial extraction (no debounce)
    update();
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 300);
    };
    editor.on("change", onChange);
    return () => {
      editor.off("change", onChange);
      clearTimeout(timer);
    };
  }, [editor, extractHeadings]);

  // Track current active heading via IntersectionObserver (scroll-based, like Notion)
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleHeadingsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (items.length === 0) return;

    // Cleanup previous observer
    observerRef.current?.disconnect();
    visibleHeadingsRef.current.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const blockId = entry.target.getAttribute("data-yoopta-block-id");
          if (!blockId) continue;
          if (entry.isIntersecting) {
            visibleHeadingsRef.current.add(blockId);
          } else {
            visibleHeadingsRef.current.delete(blockId);
          }
        }
        // Pick the first visible heading (by document order)
        const firstVisible = items.find((item) => visibleHeadingsRef.current.has(item.id));
        if (firstVisible) {
          setActiveId(firstVisible.id);
        }
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );

    observerRef.current = observer;

    // Observe all heading block elements
    for (const item of items) {
      const el = document.querySelector(`[data-yoopta-block-id="${item.id}"]`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  const handleClick = useCallback(
    (blockId: string) => {
      const block = Blocks.getBlock(editor, { id: blockId });
      if (!block) return;
      editor.setPath({ current: block.meta.order });
      editor.focus();

      // Scroll the block into view
      const blockEl = document.querySelector(`[data-yoopta-block-id="${blockId}"]`);
      blockEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [editor]
  );

  if (items.length === 0) {
    return (
      <div className={cn("text-xs text-muted-foreground/50 px-3 py-4", className)}>
        {t("editor.toc.emptyState")}
      </div>
    );
  }

  return (
    <nav
      className={cn("yoopta-toc-sidebar text-sm", className)}
      aria-label={t("editor.toc.title")}
    >
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {t("editor.toc.title")}
      </div>
      <ul className="space-y-0.5 px-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => handleClick(item.id)}
              className={cn(
                "w-full text-left px-2 py-1 rounded text-sm truncate transition-colors",
                "hover:bg-muted hover:text-foreground",
                item.id === activeId
                  ? "text-foreground font-medium bg-muted/50"
                  : "text-muted-foreground",
                item.level === 2 && "pl-5",
                item.level === 3 && "pl-8",
              )}
              title={item.text}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
