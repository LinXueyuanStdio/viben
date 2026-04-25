import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { HelpCircle, Check, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PendingQuestion, AgentQuestion } from "@/types";

interface QuestionInputProps {
  questions: PendingQuestion;
  onSubmit: (answers: Record<string, string[]>) => void;
  isSubmitting?: boolean;
  className?: string;
}

interface QuestionItemProps {
  question: AgentQuestion;
  selectedOptions: string[];
  otherInput: string;
  showOther: boolean;
  onSelectOption: (option: string) => void;
  onOtherInput: (value: string) => void;
  onToggleOther: () => void;
}

function QuestionItem({
  question,
  selectedOptions,
  otherInput,
  showOther,
  onSelectOption,
  onOtherInput,
  onToggleOther,
}: QuestionItemProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="space-y-3">
      {/* Question header and text */}
      <div className="flex items-start gap-2">
        {question.header && (
          <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs font-medium shrink-0">
            {question.header}
          </span>
        )}
        <p className="text-sm font-medium text-foreground flex-1">
          {question.question}
        </p>
      </div>

      {/* Options grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {question.options.map((option, oIndex) => {
          const isSelected = selectedOptions.includes(option.label);
          return (
            <button
              key={oIndex}
              type="button"
              onClick={() => onSelectOption(option.label)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border/60 bg-background hover:border-primary/50 hover:bg-accent/50"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  question.multiSelect ? "rounded-md" : "rounded-full",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
                )}
              >
                {isSelected && (
                  <Check className="h-3 w-3 text-primary-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isSelected && "text-primary"
                  )}
                >
                  {option.label}
                </p>
                {option.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}

        {/* Other option */}
        <button
          type="button"
          onClick={onToggleOther}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
            showOther || otherInput
              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
              : "border-border/60 bg-background hover:border-primary/50 hover:bg-accent/50"
          )}
        >
          <div
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              question.multiSelect ? "rounded-md" : "rounded-full",
              showOther || otherInput
                ? "border-primary bg-primary"
                : "border-muted-foreground/40"
            )}
          >
            {(showOther || otherInput) && (
              <Check className="h-3 w-3 text-primary-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-sm font-medium",
                (showOther || otherInput) && "text-primary"
              )}
            >
              {t("chat.other")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("chat.customInput")}
            </p>
          </div>
        </button>
      </div>

      {/* Other input field */}
      {showOther && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        >
          <input
            type="text"
            value={otherInput}
            onChange={(e) => onOtherInput(e.target.value)}
            placeholder={t("chat.otherPlaceholder")}
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
              "border-border/60 bg-background text-foreground",
              "placeholder:text-muted-foreground",
              "focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none"
            )}
            autoFocus
          />
        </motion.div>
      )}

      {/* Multi-select hint */}
      {question.multiSelect && (
        <p className="text-xs text-muted-foreground italic">
          {t("chat.multiSelectHint")}
        </p>
      )}
    </div>
  );
}

export function QuestionInput({
  questions,
  onSubmit,
  isSubmitting = false,
  className,
}: QuestionInputProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, string[]>
  >({});
  const [otherInputs, setOtherInputs] = useState<Record<number, string>>({});
  const [showOtherFlags, setShowOtherFlags] = useState<Record<number, boolean>>(
    {}
  );

  const handleOptionSelect = useCallback(
    (questionIndex: number, optionLabel: string, multiSelect: boolean) => {
      setSelectedAnswers((prev) => {
        const currentSelections = prev[questionIndex] || [];

        if (multiSelect) {
          // Toggle selection for multi-select
          if (currentSelections.includes(optionLabel)) {
            return {
              ...prev,
              [questionIndex]: currentSelections.filter(
                (o) => o !== optionLabel
              ),
            };
          }
          return {
            ...prev,
            [questionIndex]: [...currentSelections, optionLabel],
          };
        }

        // Single select - replace selection
        return {
          ...prev,
          [questionIndex]: [optionLabel],
        };
      });
    },
    []
  );

  const handleOtherInput = useCallback(
    (questionIndex: number, value: string) => {
      setOtherInputs((prev) => ({ ...prev, [questionIndex]: value }));
    },
    []
  );

  const handleToggleOther = useCallback((questionIndex: number) => {
    setShowOtherFlags((prev) => ({
      ...prev,
      [questionIndex]: !prev[questionIndex],
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    // Format answers as Record<string, string[]> to match expected signature
    const formattedAnswers: Record<string, string[]> = {};

    questions.questions.forEach((_, index) => {
      const selectedOptions = selectedAnswers[index] || [];
      const otherInput = otherInputs[index];

      const answers: string[] = [...selectedOptions];
      if (otherInput?.trim()) {
        answers.push(otherInput.trim());
      }

      if (answers.length > 0) {
        formattedAnswers[String(index)] = answers;
      }
    });

    onSubmit(formattedAnswers);
  }, [questions, selectedAnswers, otherInputs, onSubmit]);

  // Check if at least one answer is provided for each question
  const hasAnswers = questions.questions.some((_, idx) => {
    const hasSelected =
      selectedAnswers[idx] && selectedAnswers[idx].length > 0;
    const hasOther = otherInputs[idx]?.trim();
    return hasSelected || hasOther;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      className={cn("flex gap-3", className)}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
        <HelpCircle className="h-4 w-4 text-amber-500" />
      </div>
      <div className="flex-1">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              <span className="text-sm font-medium text-foreground">
                {t("chat.needsInput")}
              </span>
            </div>
          </div>

          {/* Questions */}
          {questions.questions.map((question, qIdx) => (
            <div
              key={qIdx}
              className={cn(
                "px-4 py-4",
                qIdx > 0 && "border-t border-amber-500/20"
              )}
            >
              <QuestionItem
                question={question}
                selectedOptions={selectedAnswers[qIdx] || []}
                otherInput={otherInputs[qIdx] || ""}
                showOther={showOtherFlags[qIdx] || false}
                onSelectOption={(option) =>
                  handleOptionSelect(qIdx, option, question.multiSelect)
                }
                onOtherInput={(value) => handleOtherInput(qIdx, value)}
                onToggleOther={() => handleToggleOther(qIdx)}
              />
            </div>
          ))}

          {/* Submit button */}
          <div className="px-4 py-3 bg-muted/50 border-t border-amber-500/20">
            <Button
              onClick={handleSubmit}
              disabled={!hasAnswers || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {t("chat.submitAnswer")}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
