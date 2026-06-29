import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle, X, CheckCircle2, SkipForward, ExternalLink, Terminal } from "lucide-react";
import { GithubIcon as Github } from "@/components/ui/icons";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";

// Check if running in development mode
const isDev = import.meta.env.DEV;

interface StepLoginProps {
  onComplete: () => void;
  onBack: () => void;
  onSkip?: () => void;
}

type OAuthStatus = "idle" | "waiting" | "timeout" | "success" | "error";

const OAUTH_TIMEOUT_MS = 150000; // 2.5 minutes

// OAuth flow steps for visual feedback - labels are i18n keys
const OAUTH_STEP_KEYS = ["browser", "authorize", "callback"] as const;

export function StepLogin({ onComplete, onBack, onSkip }: StepLoginProps) {
  const { t } = useTranslation();
  const { isAuthenticated, user, loginWithGitHub, handleOAuthCallback, isLoading, error, clearError, setLoading } = useAuth();
  const { logEvent } = useAnalytics();

  const [oauthStatus, setOauthStatus] = useState<OAuthStatus>("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oauthStartTimeRef = useRef<number>(0);
  const oauthErrorRef = useRef<string>("");

  // Dev mode: manual OAuth code input
  const [showDevOAuth, setShowDevOAuth] = useState(false);
  const [oauthCode, setOauthCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Clear timers
  const clearTimers = useCallback(() => {
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
  useEffect(() => {
    if (isAuthenticated && oauthStatus === "waiting") {
      clearTimers();
      setOauthStatus("success");
      setCurrentStep(2); // Show completed step

      const durationMs = Date.now() - oauthStartTimeRef.current;
      try {
        logEvent(AnalyticsEvents.ONBOARDING_OAUTH_COMPLETED, {
          provider: "github" as const,
        });
        logEvent(AnalyticsEvents.AUTH_LOGIN_SUCCESS, {
          provider: "github",
          user_id_hash: user?.username || user?.displayName || "",
          is_new_user: false,
          duration_ms: durationMs,
        });
      } catch { /* analytics is best-effort */ }
    }
  }, [isAuthenticated, oauthStatus, clearTimers, logEvent, user]);

  // Track oauthStatus transitions for auth_login_failed
  const prevOauthStatusRef = useRef<OAuthStatus>("idle");
  useEffect(() => {
    const prev = prevOauthStatusRef.current;
    prevOauthStatusRef.current = oauthStatus;

    if (prev === "waiting" && oauthStatus === "timeout") {
      try {
        logEvent(AnalyticsEvents.AUTH_LOGIN_FAILED, {
          provider: "github",
          error_type: "timeout",
          error_message: "OAuth timed out after 2.5 minutes",
        });
      } catch { /* analytics is best-effort */ }
    } else if (prev === "waiting" && oauthStatus === "error") {
      try {
        logEvent(AnalyticsEvents.AUTH_LOGIN_FAILED, {
          provider: "github",
          error_type: "oauth_error",
          error_message: oauthErrorRef.current || "OAuth flow failed",
        });
      } catch { /* analytics is best-effort */ }
    }
  }, [oauthStatus, logEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const startOAuthFlow = async () => {
    clearError();
    setFormError(null);
    setOauthStatus("waiting");
    setCurrentStep(0);
    oauthStartTimeRef.current = Date.now();

    try {
      logEvent(AnalyticsEvents.AUTH_LOGIN_ATTEMPT, {
        provider: "github",
        method: "oauth" as const,
      });
      logEvent(AnalyticsEvents.ONBOARDING_OAUTH_STARTED, {
        provider: "github" as const,
      });
    } catch { /* analytics is best-effort */ }

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
    } catch (err) {
      console.error("[StepLogin] OAuth flow failed:", err);
      oauthErrorRef.current = err instanceof Error ? err.message : String(err);
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
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  const handleContinue = () => {
    clearTimers();
    onComplete();
  };

  // Dev mode: handle manual OAuth code submission
  const handleDevOAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthCode.trim()) {
      setFormError(t("auth.oauthCodeRequired"));
      return;
    }
    try {
      await handleOAuthCallback(oauthCode.trim());
    } catch (err) {
      // Error is surfaced in UI via the useAuth hook's error state
      console.error("[StepLogin] OAuth callback failed:", err);
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
                    {OAUTH_STEP_KEYS.map((stepKey, index) => (
                      <React.Fragment key={stepKey}>
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
                            {t(`settings.account.oauth.${stepKey === "browser" ? "openBrowser" : stepKey === "authorize" ? "waitingAuth" : "completing"}`)}
                          </span>
                        </div>

                        {index < OAUTH_STEP_KEYS.length - 1 && (
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
                    {currentStep === 0 && t("settings.account.oauth.statusOpening")}
                    {currentStep === 1 && t("settings.account.oauth.statusWaiting")}
                    {currentStep === 2 && t("settings.account.oauth.statusCompleting")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {currentStep === 1 && t("settings.account.oauth.autoReturn")}
                  </p>
                </div>

                {/* Pulse animation indicator */}
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                  </span>
                  <span className="text-xs text-muted-foreground">{t("settings.account.oauth.waitingResponse")}</span>
                </div>

                {/* Dev mode: Manual OAuth code input */}
                {isDev && showDevOAuth && (
                  <form onSubmit={handleDevOAuthSubmit} className="w-full space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Terminal className="h-3 w-3" />
                      <span>{t("auth.devModeOAuthHint")}</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder={t("auth.oauthCodePlaceholder")}
                        value={oauthCode}
                        onChange={(e) => setOauthCode(e.target.value)}
                        disabled={isLoading}
                        className="flex-1 text-sm"
                      />
                      <Button type="submit" size="sm" disabled={isLoading || !oauthCode.trim()}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.submit")}
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
