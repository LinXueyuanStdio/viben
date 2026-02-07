import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
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
  questionIndex: number;
  selectedOptions: string[];
  otherInput: string;
  onSelectOption: (questionIndex: number, option: string, multiSelect: boolean) => void;
  onOtherInput: (questionIndex: number, value: string) => void;
}

function QuestionItem({
  question,
  questionIndex,
  selectedOptions,
  otherInput,
  onSelectOption,
  onOtherInput,
}: QuestionItemProps) {
  const { t } = useTranslation();
  const [showOther, setShowOther] = useState(false);

  const handleOtherClick = useCallback(() => {
    setShowOther(!showOther);
  }, [showOther]);

  return (
    <div className="space-y-3">
      {/* Question header and text */}
      <div className="flex items-start gap-2">
        {question.header && (
          <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {question.header}
          </span>
        )}
        <p className="flex-1 text-sm font-medium text-foreground">
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
              onClick={() =>
                onSelectOption(questionIndex, option.label, question.multiSelect)
              }
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              {/* Checkbox/Radio indicator */}
              <div
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors",
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
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {option.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}

        {/* "Other" option */}
        <button
          type="button"
          onClick={handleOtherClick}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-all",
            showOther || otherInput
              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
              : "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <div
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors",
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
              {t("chat.questionOther")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("chat.questionCustomInput")}
            </p>
          </div>
        </button>
      </div>

      {/* "Other" input field */}
      <AnimatePresence>
        {showOther && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <input
              type="text"
              value={otherInput}
              onChange={(e) => onOtherInput(questionIndex, e.target.value)}
              placeholder={t("chat.questionPlaceholder")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </motion.div>
        )}
      </AnimatePresence>

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
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [otherInputs, setOtherInputs] = useState<Record<number, string>>({});

  const handleOptionSelect = useCallback(
    (questionIndex: number, option: string, multiSelect: boolean) => {
      setAnswers((prev) => {
        const currentAnswers = prev[questionIndex] || [];
        if (multiSelect) {
          // Toggle selection for multi-select
          if (currentAnswers.includes(option)) {
            return {
              ...prev,
              [questionIndex]: currentAnswers.filter((a) => a !== option),
            };
          }
          return { ...prev, [questionIndex]: [...currentAnswers, option] };
        }
        // Single select - replace
        return { ...prev, [questionIndex]: [option] };
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

  const handleSubmit = useCallback(() => {
    // Format answers as Record<string, string[]> for each question
    // The key is the question index (as string), value is array of selected options
    const formattedAnswers: Record<string, string[]> = {};

    questions.questions.forEach((q, index) => {
      const selectedOptions = answers[index] || [];
      const otherInput = otherInputs[index];

      // Combine selected options with other input
      const allAnswers = [...selectedOptions];
      if (otherInput?.trim()) {
        allAnswers.push(otherInput.trim());
      }

      if (allAnswers.length > 0) {
        // Use the question text as key for identification
        formattedAnswers[q.question] = allAnswers;
      }
    });

    onSubmit(formattedAnswers);
  }, [questions, answers, otherInputs, onSubmit]);

  // Check if there are any answers (either selected options or other inputs)
  const hasAnswers =
    Object.keys(answers).some((k) => answers[parseInt(k)]?.length > 0) ||
    Object.values(otherInputs).some((v) => v?.trim());

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
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-amber-500/20">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              {t("chat.needsInput")}
            </div>
          </div>

          {/* Questions */}
          {questions.questions.map((question, qIdx) => (
            <div
              key={qIdx}
              className={cn(
                "px-4 py-3",
                qIdx > 0 && "border-t border-amber-500/20"
              )}
            >
              <QuestionItem
                question={question}
                questionIndex={qIdx}
                selectedOptions={answers[qIdx] || []}
                otherInput={otherInputs[qIdx] || ""}
                onSelectOption={handleOptionSelect}
                onOtherInput={handleOtherInput}
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
