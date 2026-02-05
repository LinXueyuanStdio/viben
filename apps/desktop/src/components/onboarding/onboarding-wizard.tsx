import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/app-store";
import { OnboardingProgress, type OnboardingStep } from "./onboarding-progress";
import { StepPython } from "./step-python";
import { StepClaude } from "./step-claude";
import { StepLogin } from "./step-login";

export function OnboardingWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOnboardingCompleted } = useAppStore();

  const [currentStep, setCurrentStep] = React.useState<OnboardingStep>("python");
  const [completedSteps, setCompletedSteps] = React.useState<OnboardingStep[]>([]);

  const completeStep = (step: OnboardingStep) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
    }
  };

  const handlePythonComplete = () => {
    completeStep("python");
    setCurrentStep("claude");
  };

  const handleClaudeComplete = () => {
    completeStep("claude");
    setCurrentStep("login");
  };

  const handleClaudeBack = () => {
    setCurrentStep("python");
  };

  const handleLoginComplete = () => {
    completeStep("login");
    setOnboardingCompleted(true);
    navigate("/workspace/global", { replace: true });
  };

  const handleLoginBack = () => {
    setCurrentStep("claude");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with logo */}
      <header className="flex items-center justify-center border-b py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            V
          </div>
          <span className="text-lg font-semibold">Viben</span>
        </div>
      </header>

      {/* Progress indicator */}
      <div className="border-b py-6">
        <OnboardingProgress currentStep={currentStep} completedSteps={completedSteps} />
      </div>

      {/* Step content */}
      <main className="flex flex-1 items-start justify-center overflow-auto py-8">
        <div className="w-full max-w-lg px-4">
          {currentStep === "python" && (
            <StepPython onComplete={handlePythonComplete} />
          )}
          {currentStep === "claude" && (
            <StepClaude onComplete={handleClaudeComplete} onBack={handleClaudeBack} />
          )}
          {currentStep === "login" && (
            <StepLogin onComplete={handleLoginComplete} onBack={handleLoginBack} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 text-center text-sm text-muted-foreground">
        {t("onboarding.footer")}
      </footer>
    </div>
  );
}
