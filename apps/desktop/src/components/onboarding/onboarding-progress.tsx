import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type OnboardingStep = "welcome" | "envCheck" | "login" | "agentSetup";

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
}

const STEPS: { key: OnboardingStep; labelKey: string }[] = [
  { key: "welcome", labelKey: "onboarding.progress.welcome" },
  { key: "envCheck", labelKey: "onboarding.progress.envCheck" },
  { key: "login", labelKey: "onboarding.progress.login" },
  { key: "agentSetup", labelKey: "onboarding.progress.agentSetup" },
];

export function OnboardingProgress({ currentStep, completedSteps }: OnboardingProgressProps) {
  const { t } = useTranslation();

  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, index) => {
        const isCompleted = completedSteps.includes(step.key);
        const isCurrent = step.key === currentStep;
        const isPast = index < currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isCurrent && !isCompleted && "border-primary bg-background text-primary",
                  !isCurrent && !isCompleted && "border-muted-foreground/30 bg-background text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-xs font-medium",
                  isCurrent && "text-foreground",
                  !isCurrent && "text-muted-foreground"
                )}
              >
                {t(step.labelKey)}
              </span>
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 w-12 transition-colors",
                  isPast || isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
