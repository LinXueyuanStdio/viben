import * as React from "react";
import { useTranslation } from "react-i18next";
import { Github, Loader2, AlertCircle, X, CheckCircle2, SkipForward, ExternalLink, Terminal } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Check if running in development mode
const isDev = import.meta.env.DEV;

interface StepLoginProps {
  onComplete: () => void;
  onBack: () => void;
}

type OAuthStatus = "idle" | "waiting" | "timeout" | "success" | "error";

const OAUTH_TIMEOUT_MS = 150000; // 2.5 minutes

// OAuth flow steps for visual feedback
const OAUTH_STEPS = [
  { key: "browser", label: "打开浏览器" },
  { key: "authorize", label: "等待授权" },
  { key: "callback", label: "完成登录" },
] as const;

export function StepLogin({ onComplete, onBack }: StepLoginProps) {
  const { t } = useTranslation();
  const { isAuthenticated, user, loginWithGitHub, handleOAuthCallback, isLoading, error, clearError, setLoading } = useAuth();

  const [oauthStatus, setOauthStatus] = React.useState<OAuthStatus>("idle");
  const [currentStep, setCurrentStep] = React.useState(0);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Dev mode: manual OAuth code input
  const [showDevOAuth, setShowDevOAuth] = React.useState(false);
  const [oauthCode, setOauthCode] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  // Clear timers
  const clearTimers = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  }, []);

  // Handle successful auth
  React.useEffect(() => {
    if (isAuthenticated && oauthStatus === "waiting") {
      clearTimers();
      setOauthStatus("success");
      setCurrentStep(2); // Show completed step
    }
  }, [isAuthenticated, oauthStatus, clearTimers]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const startOAuthFlow = async () => {
    clearError();
    setFormError(null);
    setOauthStatus("waiting");
    setCurrentStep(0);

    try {
      await loginWithGitHub();

      // Show dev OAuth input in dev mode
      if (isDev) {
        setShowDevOAuth(true);
      }

      // Animate through steps while waiting
      let step = 0;
      stepIntervalRef.current = setInterval(() => {
        // Only animate between step 0 and 1
        if (step < 1) {
          step++;
          setCurrentStep(step);
        }
      }, 2000);

      // Set timeout
      timeoutRef.current = setTimeout(() => {
        clearTimers();
        setOauthStatus("timeout");
        setLoading(false);
      }, OAUTH_TIMEOUT_MS);
    } catch {
      setOauthStatus("error");
    }
  };

  const cancelOAuth = () => {
    clearTimers();
    clearError();
    setFormError(null);
    setOauthStatus("idle");
    setShowDevOAuth(false);
    setOauthCode("");
    setLoading(false);
  };

  const handleSkip = () => {
    clearTimers();
    setLoading(false);
    onComplete();
  };

  const handleContinue = () => {
    clearTimers();
    onComplete();
  };

  // Dev mode: handle manual OAuth code submission
  const handleDevOAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthCode.trim()) {
      setFormError(t("auth.oauthCodeRequired", "请输入 OAuth 授权码"));
      return;
    }
    try {
      await handleOAuthCallback(oauthCode.trim());
    } catch {
      // Error is handled by the hook
    }
  };

  const displayError = formError || error;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t("onboarding.login.title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("onboarding.login.description")}</p>
      </div>

      {/* Success state */}
      {(oauthStatus === "success" || isAuthenticated) && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div className="text-center">
              <p className="font-medium">{t("onboarding.login.success")}</p>
              {user && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("onboarding.login.welcomeUser", { name: user.displayName || user.username })}
                </p>
              )}
            </div>
            {user?.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.displayName || user.username}
                className="h-12 w-12 rounded-full ring-2 ring-primary/20"
              />
            )}
          </div>
        </div>
      )}

      {/* Login form - only shown when not authenticated */}
      {!isAuthenticated && (
        <div className="rounded-lg border bg-card p-6">
          <div className="space-y-6">
            {/* Error display */}
            {displayError && oauthStatus !== "waiting" && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{displayError}</span>
              </div>
            )}

            {/* Waiting for OAuth */}
            {oauthStatus === "waiting" ? (
              <div className="flex flex-col items-center space-y-6">
                {/* Animated icon */}
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 border-primary">
                    <ExternalLink className="h-3 w-3 text-primary" />
                  </div>
                </div>

                {/* Progress steps */}
                <div className="w-full max-w-xs">
                  <div className="flex items-center justify-between">
                    {OAUTH_STEPS.map((step, index) => (
                      <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all duration-300",
                              index < currentStep
                                ? "bg-primary text-primary-foreground"
                                : index === currentStep
                                  ? "bg-primary/20 text-primary ring-2 ring-primary ring-offset-2"
                                  : "bg-muted text-muted-foreground"
                            )}
                          >
                            {index < currentStep ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              index + 1
                            )}
                          </div>
                          <span
                            className={cn(
                              "mt-1 text-xs transition-colors",
                              index <= currentStep ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {step.label}
                          </span>
                        </div>

                        {index < OAUTH_STEPS.length - 1 && (
                          <div
                            className={cn(
                              "h-0.5 flex-1 mx-2 transition-colors duration-300",
                              index < currentStep ? "bg-primary" : "bg-muted"
                            )}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Status text */}
                <div className="text-center">
                  <p className="font-medium">
                    {currentStep === 0 && "正在打开浏览器..."}
                    {currentStep === 1 && "请在浏览器中完成授权"}
                    {currentStep === 2 && "授权成功，正在登录..."}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {currentStep === 1 && "完成后会自动返回应用"}
                  </p>
                </div>

                {/* Pulse animation indicator */}
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                  </span>
                  <span className="text-xs text-muted-foreground">等待响应中</span>
                </div>

                {/* Dev mode: Manual OAuth code input */}
                {isDev && showDevOAuth && (
                  <form onSubmit={handleDevOAuthSubmit} className="w-full space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Terminal className="h-3 w-3" />
                      <span>{t("auth.devModeOAuthHint", "Dev Mode: 从 URL 粘贴 OAuth 授权码")}</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder={t("auth.oauthCodePlaceholder", "粘贴 viben://oauth?code=... 中的 code")}
                        value={oauthCode}
                        onChange={(e) => setOauthCode(e.target.value)}
                        disabled={isLoading}
                        className="flex-1 text-sm"
                      />
                      <Button type="submit" size="sm" disabled={isLoading || !oauthCode.trim()}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.submit", "提交")}
                      </Button>
                    </div>
                  </form>
                )}

                <Button variant="outline" onClick={cancelOAuth} className="w-full max-w-xs">
                  <X className="mr-2 h-4 w-4" />
                  {t("common.cancel")}
                </Button>
              </div>
            ) : oauthStatus === "timeout" ? (
              /* Timeout */
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t("onboarding.login.timeout")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.login.timeoutHint")}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSkip}>
                    <SkipForward className="mr-2 h-4 w-4" />
                    {t("onboarding.login.skip")}
                  </Button>
                  <Button onClick={startOAuthFlow}>
                    {t("onboarding.login.retry")}
                  </Button>
                </div>
              </div>
            ) : oauthStatus === "error" ? (
              /* Error state */
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t("onboarding.login.error")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.login.errorHint")}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSkip}>
                    <SkipForward className="mr-2 h-4 w-4" />
                    {t("onboarding.login.skip")}
                  </Button>
                  <Button onClick={startOAuthFlow}>
                    {t("onboarding.login.retry")}
                  </Button>
                </div>
              </div>
            ) : (
              /* Idle state - GitHub login */
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Github className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t("onboarding.login.signInPrompt")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.login.benefits")}</p>
                </div>
                <Button
                  onClick={startOAuthFlow}
                  disabled={isLoading}
                  className="w-full max-w-xs"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Github className="mr-2 h-4 w-4" />
                  )}
                  {t("auth.continueWithGitHub")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={oauthStatus === "waiting"}>
          {t("common.previous")}
        </Button>
        {isAuthenticated ? (
          <Button onClick={handleContinue}>
            {t("onboarding.login.finish")}
          </Button>
        ) : (
          <Button variant="ghost" onClick={handleSkip} disabled={oauthStatus === "waiting"}>
            <SkipForward className="mr-2 h-4 w-4" />
            {t("onboarding.login.skip")}
          </Button>
        )}
      </div>
    </div>
  );
}
