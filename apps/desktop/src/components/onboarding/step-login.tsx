import * as React from "react";
import { useTranslation } from "react-i18next";
import { Github, Loader2, AlertCircle, Clock, X, CheckCircle2, SkipForward } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

interface StepLoginProps {
  onComplete: () => void;
  onBack: () => void;
}

type OAuthStatus = "idle" | "waiting" | "timeout" | "success" | "error";

const OAUTH_TIMEOUT_MS = 150000; // 2.5 minutes

export function StepLogin({ onComplete, onBack }: StepLoginProps) {
  const { t } = useTranslation();
  const { isAuthenticated, user, loginWithGitHub, isLoading, error, clearError } = useAuth();

  const [oauthStatus, setOauthStatus] = React.useState<OAuthStatus>("idle");
  const [remainingTime, setRemainingTime] = React.useState(OAUTH_TIMEOUT_MS);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear timers
  const clearTimers = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Handle successful auth
  React.useEffect(() => {
    if (isAuthenticated && oauthStatus === "waiting") {
      clearTimers();
      setOauthStatus("success");
    }
  }, [isAuthenticated, oauthStatus, clearTimers]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const startOAuthFlow = async () => {
    clearError();
    setOauthStatus("waiting");
    setRemainingTime(OAUTH_TIMEOUT_MS);

    try {
      await loginWithGitHub();

      // Start countdown
      const startTime = Date.now();
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, OAUTH_TIMEOUT_MS - elapsed);
        setRemainingTime(remaining);

        if (remaining === 0) {
          clearTimers();
          setOauthStatus("timeout");
        }
      }, 1000);

      // Set timeout
      timeoutRef.current = setTimeout(() => {
        clearTimers();
        setOauthStatus("timeout");
      }, OAUTH_TIMEOUT_MS);
    } catch {
      setOauthStatus("error");
    }
  };

  const cancelOAuth = () => {
    clearTimers();
    clearError();
    setOauthStatus("idle");
  };

  const handleSkip = () => {
    clearTimers();
    onComplete();
  };

  const handleContinue = () => {
    clearTimers();
    onComplete();
  };

  // Format remaining time as MM:SS
  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t("onboarding.login.title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("onboarding.login.description")}</p>
      </div>

      {/* Error display */}
      {error && oauthStatus !== "waiting" && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main content based on status */}
      <div className="rounded-lg border p-6">
        {/* Idle state */}
        {oauthStatus === "idle" && !isAuthenticated && (
          <div className="flex flex-col items-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Github className="h-8 w-8" />
            </div>
            <div className="text-center">
              <p className="font-medium">{t("onboarding.login.signInPrompt")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.login.benefits")}</p>
            </div>
            <Button onClick={startOAuthFlow} disabled={isLoading} className="w-full max-w-xs">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Github className="mr-2 h-4 w-4" />
              )}
              {t("auth.continueWithGitHub")}
            </Button>
          </div>
        )}

        {/* Waiting for OAuth */}
        {oauthStatus === "waiting" && (
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-medium">{t("onboarding.login.waitingAuth")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.login.waitingHint")}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono">{formatTime(remainingTime)}</span>
              <span className="text-muted-foreground">{t("onboarding.login.remaining")}</span>
            </div>
            <Button variant="outline" onClick={cancelOAuth}>
              <X className="mr-2 h-4 w-4" />
              {t("common.cancel")}
            </Button>
          </div>
        )}

        {/* Timeout */}
        {oauthStatus === "timeout" && (
          <div className="flex flex-col items-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="h-8 w-8 text-amber-500" />
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
        )}

        {/* Success */}
        {(oauthStatus === "success" || isAuthenticated) && (
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
                className="h-12 w-12 rounded-full"
              />
            )}
          </div>
        )}

        {/* Error state */}
        {oauthStatus === "error" && !isAuthenticated && (
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
        )}
      </div>

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
