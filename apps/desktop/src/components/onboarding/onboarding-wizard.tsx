import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useTabStore } from "@/stores/tab-store";
import { OnboardingProgress, type OnboardingStep } from "./onboarding-progress";
import { WelcomePage } from "./welcome-page";
import { GatewaySetupPage } from "./gateway-setup-page";
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
import { WindowControls } from "@/components/global-tab-bar/window-controls";
import { createTabNavigationState } from "@/navigation/tab-navigation";
import { buildColdStartBreadcrumb } from "@/navigation/navigate";
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";
import { getPlatformType } from "@/lib/platform";

const STEP_NAMES: Record<OnboardingStep, string> = {
  welcome: "welcome",
  envCheck: "envCheck",
  login: "login",
  agentSetup: "agentSetup",
};

const STEP_INDICES: Record<OnboardingStep, number> = {
  welcome: 0,
  envCheck: 1,
  login: 2,
  agentSetup: 3,
};

const TOTAL_STEPS = 4;

export function OnboardingWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOnboardingCompleted, setLanguage } = useAppStore();
  const openTab = useTabStore((state) => state.openTab);
  const currentLanguage = getCurrentLanguage();
  const { logEvent } = useAnalytics();

  const startTimeRef = useRef<number>(Date.now());
  const skippedStepsRef = useRef<Set<OnboardingStep>>(new Set());
  const onboardingStartedRef = useRef(false);

  // onboarding_started on first mount
  useEffect(() => {
    if (onboardingStartedRef.current) return;
    onboardingStartedRef.current = true;
    try {
      logEvent(AnalyticsEvents.ONBOARDING_STARTED, {
        app_version: import.meta.env.VITE_APP_VERSION || "0.0.0",
        platform: getPlatformType(),
        language: currentLanguage,
      });
    } catch { /* analytics is best-effort */ }
  }, []);

  const handleLanguageChange = async (langCode: string) => {
    await changeLanguage(langCode);
    setLanguage(langCode);
  };

  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);

  // onboarding_step_viewed when currentStep changes
  useEffect(() => {
    try {
      logEvent(AnalyticsEvents.ONBOARDING_STEP_VIEWED, {
        step_name: STEP_NAMES[currentStep],
        step_index: STEP_INDICES[currentStep],
        total_steps: TOTAL_STEPS,
      });
    } catch { /* analytics is best-effort */ }
  }, [currentStep]);

  const completeStep = (step: OnboardingStep) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
      try {
        logEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
          step_name: STEP_NAMES[step],
          step_index: STEP_INDICES[step],
          total_steps: TOTAL_STEPS,
        });
      } catch { /* analytics is best-effort */ }
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

    try {
      const totalDurationMs = Date.now() - startTimeRef.current;
      logEvent(AnalyticsEvents.ONBOARDING_COMPLETED, {
        total_duration_ms: totalDurationMs,
        total_steps: TOTAL_STEPS,
        skipped_steps: skippedStepsRef.current.size,
      });
    } catch { /* analytics is best-effort */ }

    // Create an initial tab for the workspace
    const url = "/workspace/global";
    openTab({
      navigationState: createTabNavigationState(url, buildColdStartBreadcrumb(url)),
      pinned: false,
    });
    navigate(url, { replace: true });
  };

  const handleAgentSetupBack = () => {
    setCurrentStep("login");
  };

  const handleLoginSkip = () => {
    skippedStepsRef.current.add("login");
    handleLoginComplete();
  };

  const handleAgentSetupSkip = () => {
    skippedStepsRef.current.add("agentSetup");
    handleAgentSetupComplete();
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="border-b">
        {/* Top strip: drag region + window controls (Windows/Linux) */}
        <div className="flex items-center" data-tauri-drag-region>
          <div className="h-10 flex-1" data-tauri-drag-region />
          <WindowControls />
        </div>

        {/* Logo and language selector row */}
        <div className="flex items-center justify-between px-4 pb-4">
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
        </div>
      </header>

      {/* Progress indicator */}
      <div className="border-b py-6">
        <OnboardingProgress currentStep={currentStep} completedSteps={completedSteps} />
      </div>

      {/* Step content */}
      <main className="flex min-h-0 flex-1 items-start justify-center overflow-auto py-8">
        <div className="w-full max-w-lg px-4">
          {currentStep === "welcome" && (
            <WelcomePage onAccept={handleWelcomeAccept} />
          )}
          {currentStep === "envCheck" && (
            <GatewaySetupPage
              onComplete={handleEnvCheckComplete}
              onBack={handleEnvCheckBack}
            />
          )}
          {currentStep === "login" && (
            <StepLogin onComplete={handleLoginComplete} onBack={handleLoginBack} onSkip={handleLoginSkip} />
          )}
          {currentStep === "agentSetup" && (
            <StepAgentSetup onComplete={handleAgentSetupComplete} onBack={handleAgentSetupBack} onSkip={handleAgentSetupSkip} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t py-4 text-center text-sm text-muted-foreground"
        data-tauri-drag-region
      >
        {t("onboarding.footer")}
      </footer>
    </div>
  );
}
