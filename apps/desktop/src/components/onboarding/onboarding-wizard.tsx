import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { OnboardingProgress, type OnboardingStep } from "./onboarding-progress";
import { StepPython } from "./step-python";
import { StepClaude } from "./step-claude";
import { StepLogin } from "./step-login";
import { VibenLogo } from "@/components/ui/viben-logo";
import { LANGUAGES } from "@/i18n/languages";
import { changeLanguage, getCurrentLanguage } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function OnboardingWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOnboardingCompleted, setLanguage } = useAppStore();
  const currentLanguage = getCurrentLanguage();

  const handleLanguageChange = async (langCode: string) => {
    await changeLanguage(langCode);
    setLanguage(langCode);
  };

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
      {/* Header with logo and language switcher */}
      <header className="flex items-center justify-between border-b px-4 py-4">
        <div className="w-[140px]" /> {/* Spacer for centering logo */}
        <VibenLogo size="md" showText />
        <div className="w-[140px] flex justify-end">
          <Select value={currentLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <Globe className="h-4 w-4 mr-2 shrink-0" />
              <SelectValue>
                {LANGUAGES.find((l) => l.code === currentLanguage)?.nativeName || currentLanguage}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.nativeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
