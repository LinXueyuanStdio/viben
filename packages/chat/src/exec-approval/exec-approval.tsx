import * as React from "react";
import { useEffect, useCallback, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Shield, Terminal, FileEdit, Eye, ChevronDown, ChevronRight } from "lucide-react";
import { createJSONEditor, type JSONEditorPropsOptional } from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";
import { cn, Button } from "@viben/ui";
import type { PendingExecApproval } from "./types";

export interface ExecApprovalProps {
  approval: PendingExecApproval;
  /** Called with decision + optional feedback text */
  onDecision: (decision: string, feedback?: string) => void;
  className?: string;
  /** Enable keyboard shortcuts (Y/Enter=allow, A=always, N/Escape=reject, Tab=feedback). Default: true */
  enableKeyboard?: boolean;
  /** Whether to show the feedback input option. Default: true */
  showFeedback?: boolean;
}

const kindConfig = {
  read: { icon: Eye, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  edit: { icon: FileEdit, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  execute: { icon: Terminal, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
} as const;

function tryParseJson(text: string): unknown | undefined {
  try {
    const trimmed = text.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      return JSON.parse(trimmed);
    }
  } catch { /* not JSON */ }
  return undefined;
}

function JsonTreeViewer({ data }: { data: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof createJSONEditor> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const editor = createJSONEditor({
      target: containerRef.current,
      props: {
        content: { json: data },
        readOnly: true,
        mode: "tree",
        mainMenuBar: false,
        navigationBar: false,
        statusBar: false,
        indentation: 2,
      } as JSONEditorPropsOptional,
    });
    editorRef.current = editor;
    return () => { editor.destroy(); };
  }, [data]);

  return <div ref={containerRef} className="jse-theme-dark max-h-[min(50vh,400px)] overflow-y-auto" />;
}

function CollapsibleInput({ command, icon }: { command: string; icon: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const [overflows, setOverflows] = useState(false);

  const jsonData = React.useMemo(() => tryParseJson(command), [command]);

  useEffect(() => {
    if (jsonData !== undefined) {
      setOverflows(true);
      return;
    }
    const el = preRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [command, jsonData]);

  const lineCount = command.split("\n").length;

  return (
    <div className="mb-3 rounded-md border border-border/50 bg-code-block">
      {jsonData !== undefined ? (
        <>
          <div className="flex items-start gap-2 p-3 pb-2">
            {icon}
            <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-sm leading-5 text-foreground max-h-[6.25rem] overflow-hidden">
              {command}
            </pre>
          </div>
          {expanded && (
            <div className="border-t border-border/30 px-1">
              <JsonTreeViewer data={jsonData} />
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-center gap-1 border-t border-border/30 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? "收起" : "展开 JSON 树"}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-start gap-2 p-3 pb-0">
            {icon}
            <pre
              ref={preRef}
              className={cn(
                "min-w-0 whitespace-pre-wrap break-words font-mono text-sm leading-5 text-foreground",
                !expanded && "max-h-[6.25rem] overflow-hidden",
                expanded && "max-h-[min(50vh,400px)] overflow-y-auto",
              )}
            >
              {command}
            </pre>
          </div>
          {overflows && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-center gap-1 border-t border-border/30 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors cursor-pointer"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "收起" : `展开全部 (${lineCount} 行)`}
            </button>
          )}
          {!overflows && <div className="pb-3" />}
        </>
      )}
    </div>
  );
}

export function ExecApproval({
  approval,
  onDecision,
  className,
  enableKeyboard = true,
  showFeedback = true,
}: ExecApprovalProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [pendingDecision, setPendingDecision] = useState<string>("allow_once");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const kind = approval.tool_call.kind || "execute";
  const config = kindConfig[kind] || kindConfig.execute;
  const Icon = config.icon;
  const command = approval.tool_call.command ||
    approval.tool_call.title ||
    t("chat.execApproval.unknownCommand", "Unknown command");

  const submitDecision = useCallback(
    (decision: string) => {
      const feedback = feedbackText.trim() || undefined;
      onDecision(decision, feedback);
    },
    [onDecision, feedbackText],
  );

  const handleAllow = useCallback(() => {
    if (feedbackOpen && feedbackText.trim()) {
      submitDecision("allow_once");
    } else {
      onDecision("allow_once");
    }
  }, [feedbackOpen, feedbackText, submitDecision, onDecision]);

  const handleAlways = useCallback(() => {
    if (feedbackOpen && feedbackText.trim()) {
      submitDecision("allow_always");
    } else {
      onDecision("allow_always");
    }
  }, [feedbackOpen, feedbackText, submitDecision, onDecision]);

  const handleReject = useCallback(() => {
    if (feedbackOpen && feedbackText.trim()) {
      submitDecision("reject");
    } else {
      onDecision("reject");
    }
  }, [feedbackOpen, feedbackText, submitDecision, onDecision]);

  const toggleFeedback = useCallback(() => {
    setFeedbackOpen((prev) => {
      if (!prev) {
        // Opening feedback - focus textarea on next tick
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
      return !prev;
    });
  }, []);

  // Auto-resize textarea
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setFeedbackText(e.target.value);
      // Auto-grow
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    [],
  );

  // Keyboard shortcuts for feedback textarea
  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setFeedbackOpen(false);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitDecision(pendingDecision);
        return;
      }
    },
    [submitDecision, pendingDecision],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboard) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // When feedback textarea is focused, let the textarea's own handler deal with it
      if (target === textareaRef.current) return;

      // Don't intercept when user is typing in other inputs
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      // Tab toggles feedback mode
      if (e.key === "Tab" && showFeedback) {
        e.preventDefault();
        toggleFeedback();
        return;
      }

      // When feedback is open but textarea is not focused, don't process Y/A/N
      // (user might have just tabbed away). Only Enter/Escape still work.
      if (feedbackOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setFeedbackOpen(false);
          return;
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case "y":
        case "enter":
          e.preventDefault();
          handleAllow();
          break;
        case "a":
          e.preventDefault();
          handleAlways();
          break;
        case "n":
        case "escape":
          e.preventDefault();
          handleReject();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    enableKeyboard,
    showFeedback,
    feedbackOpen,
    handleAllow,
    handleAlways,
    handleReject,
    toggleFeedback,
  ]);

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}
    >
      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", config.bg)}>
          <Shield className={cn("h-4 w-4", config.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {t("chat.execApproval.title", "Permission Required")}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {kind}
            </span>
          </div>
          {approval.tool_call.title && (
            <div className="mt-0.5 break-words text-xs text-muted-foreground">
              {approval.tool_call.title}
            </div>
          )}
        </div>
      </div>

      {/* Tool call info */}
      <CollapsibleInput command={command} icon={<Icon className={cn("h-4 w-4 shrink-0 mt-0.5", config.color)} />} />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          className={cn("text-xs gap-1", feedbackOpen ? "h-6" : "h-7")}
          onClick={() => {
            setPendingDecision("allow_once");
            handleAllow();
          }}
          onMouseEnter={() => setPendingDecision("allow_once")}
          onFocus={() => setPendingDecision("allow_once")}
        >
          {t("chat.execApproval.allow", "Allow")}
          <kbd className="ml-1 text-[10px] opacity-60 font-mono">Y</kbd>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className={cn("text-xs gap-1", feedbackOpen ? "h-6" : "h-7")}
          onClick={() => {
            setPendingDecision("allow_always");
            handleAlways();
          }}
          onMouseEnter={() => setPendingDecision("allow_always")}
          onFocus={() => setPendingDecision("allow_always")}
        >
          {t("chat.execApproval.always", "Always")}
          <kbd className="ml-1 text-[10px] opacity-60 font-mono">A</kbd>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            "text-xs gap-1 text-destructive hover:text-destructive",
            feedbackOpen ? "h-6" : "h-7",
          )}
          onClick={() => {
            setPendingDecision("reject");
            handleReject();
          }}
          onMouseEnter={() => setPendingDecision("reject")}
          onFocus={() => setPendingDecision("reject")}
        >
          {t("chat.execApproval.reject", "Reject")}
          <kbd className="ml-1 text-[10px] opacity-60 font-mono">N</kbd>
        </Button>

        {/* Tab hint */}
        {showFeedback && !feedbackOpen && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            <kbd className="font-mono opacity-60">Tab</kbd>{" "}
            {t("chat.execApproval.tabForFeedback", "for feedback")}
          </span>
        )}
      </div>

      {/* Feedback textarea */}
      <AnimatePresence>
        {showFeedback && feedbackOpen && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-3">
              <textarea
                ref={textareaRef}
                value={feedbackText}
                onChange={handleTextareaChange}
                onKeyDown={handleTextareaKeyDown}
                placeholder={t(
                  "chat.execApproval.feedbackPlaceholder",
                  "Add context or instructions...",
                )}
                rows={2}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm resize-none transition-colors",
                  "border-border/60 bg-background text-foreground",
                  "placeholder:text-muted-foreground",
                  "focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none",
                )}
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="font-mono opacity-60">Enter</kbd>{" "}
                  {t("chat.execApproval.submitFeedback", "submit")}
                  {" / "}
                  <kbd className="font-mono opacity-60">Esc</kbd>{" "}
                  {t("chat.execApproval.closeFeedback", "close")}
                  {" / "}
                  <kbd className="font-mono opacity-60">Shift+Enter</kbd>{" "}
                  {t("chat.execApproval.newLine", "new line")}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatApprovalValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
