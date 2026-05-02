import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { OnboardingProgress, type OnboardingStep } from "./onboarding-progress";
import { WelcomePage } from "./welcome-page";
import { EnvCheckPage } from "./env-check-page";
import { StepLogin } from "./step-login";
import { StepAgentSetup } from "./step-agent-setup";
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

  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);

  const completeStep = (step: OnboardingStep) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
    }
  };

  const handleWelcomeAccept = () => {
    completeStep("welcome");
    setCurrentStep("envCheck");
  };

  const handleEnvCheckComplete = () => {
    completeStep("envCheck");
    setCurrentStep("login");
  };

  const handleEnvCheckBack = () => {
    setCurrentStep("welcome");
  };

  const handleLoginComplete = () => {
    completeStep("login");
    setCurrentStep("agentSetup");
  };

  const handleLoginBack = () => {
    setCurrentStep("envCheck");
  };

  const handleAgentSetupComplete = () => {
    completeStep("agentSetup");
    setOnboardingCompleted(true);
    navigate("/workspace/global", { replace: true });
  };

  const handleAgentSetupBack = () => {
    setCurrentStep("login");
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
          {currentStep === "welcome" && (
            <WelcomePage onAccept={handleWelcomeAccept} />
          )}
          {currentStep === "envCheck" && (
            <EnvCheckPage
              onComplete={handleEnvCheckComplete}
              onBack={handleEnvCheckBack}
            />
          )}
          {currentStep === "login" && (
            <StepLogin onComplete={handleLoginComplete} onBack={handleLoginBack} />
          )}
          {currentStep === "agentSetup" && (
            <StepAgentSetup onComplete={handleAgentSetupComplete} onBack={handleAgentSetupBack} />
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
