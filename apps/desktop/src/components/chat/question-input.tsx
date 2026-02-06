import * as React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { HelpCircle, Check, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PendingQuestion } from "@/types";

interface QuestionInputProps {
  questions: PendingQuestion;
  onSubmit: (answers: Record<string, string[]>) => void;
  className?: string;
}

export function QuestionInput({
  questions,
  onSubmit,
  className,
}: QuestionInputProps) {
  const { t } = useTranslation();
  const [selectedAnswers, setSelectedAnswers] = React.useState<
    Record<string, string[]>
  >({});

  const handleOptionSelect = (
    questionIndex: number,
    optionLabel: string,
    multiSelect: boolean
  ) => {
    const key = String(questionIndex);
    setSelectedAnswers((prev) => {
      const currentSelections = prev[key] || [];

      if (multiSelect) {
        // Toggle selection for multi-select
        if (currentSelections.includes(optionLabel)) {
          return {
            ...prev,
            [key]: currentSelections.filter((o) => o !== optionLabel),
          };
        }
        return {
          ...prev,
          [key]: [...currentSelections, optionLabel],
        };
      }

      // Single select - replace selection
      return {
        ...prev,
        [key]: [optionLabel],
      };
    });
  };

  const handleSubmit = () => {
    // Ensure at least one answer is selected for each question
    const allAnswered = questions.questions.every(
      (_, idx) =>
        selectedAnswers[String(idx)] && selectedAnswers[String(idx)].length > 0
    );

    if (!allAnswered) {
      return;
    }

    onSubmit(selectedAnswers);
  };

  const isComplete = questions.questions.every(
    (_, idx) =>
      selectedAnswers[String(idx)] && selectedAnswers[String(idx)].length > 0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", className)}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
        <HelpCircle className="h-4 w-4 text-amber-500" />
      </div>
      <div className="flex-1">
        <div className="rounded-2xl rounded-tl-md border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          {questions.questions.map((question, qIdx) => (
            <div
              key={qIdx}
              className={cn(
                "px-4 py-3",
                qIdx > 0 && "border-t border-amber-500/20"
              )}
            >
              {/* Question header */}
              {question.header && (
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-1">
                  {question.header}
                </p>
              )}
              <p className="text-sm font-medium text-foreground mb-3">
                {question.question}
              </p>

              {/* Options */}
              <div className="space-y-2">
                {question.options.map((option, oIdx) => {
                  const isSelected =
                    selectedAnswers[String(qIdx)]?.includes(option.label) ||
                    false;

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() =>
                        handleOptionSelect(
                          qIdx,
                          option.label,
                          question.multiSelect
                        )
                      }
                      className={cn(
                        "w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
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
              </div>

              {question.multiSelect && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  {t("chat.multiSelectHint")}
                </p>
              )}
            </div>
          ))}

          {/* Submit button */}
          <div className="px-4 py-3 bg-muted/50 border-t border-amber-500/20">
            <Button
              onClick={handleSubmit}
              disabled={!isComplete}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {t("chat.submitAnswer")}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
