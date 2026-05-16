import { useState, useCallback, useRef, useEffect } from "react";
import {
  AlertCircle,
  RefreshCw,
  Loader2,
  ExternalLink,
  CheckCircle2,
  User,
  Terminal,
  X,
} from "lucide-react";
import { LogOut } from "lucide-react";
import { GithubIcon as Github } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import * as React from "react";
import type { OAuthStatus } from "./constants";
import { OAUTH_TIMEOUT_MS, OAUTH_STEPS } from "./constants";
import { TradingAccountsSection } from "../trading-accounts-section";

export function AccountSection() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout, loginWithGitHub, handleOAuthCallback, isLoading, error, clearError, setLoading } = useAuth();

  const [oauthStatus, setOauthStatus] = useState<OAuthStatus>("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


  // Dev mode: manual OAuth code input
  const isDev = import.meta.env.DEV;
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
      setCurrentStep(2);
    }
  }, [isAuthenticated, oauthStatus, clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const startOAuthFlow = async () => {
    clearError();
    setFormError(null);
    setOauthStatus("waiting");
    setCurrentStep(0);

    try {
      await loginWithGitHub();

      if (isDev) {
        setShowDevOAuth(true);
      }

      let step = 0;
      stepIntervalRef.current = setInterval(() => {
        if (step < 1) {
          step++;
          setCurrentStep(step);
        }
      }, 2000);

      timeoutRef.current = setTimeout(() => {
        clearTimers();
        setOauthStatus("timeout");
        setLoading(false);
      }, OAUTH_TIMEOUT_MS);
    } catch (err) {
      console.error("[AccountSection] OAuth flow failed:", err);
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
      console.error("[AccountSection] OAuth callback failed:", err);
    }
  };

  // Handle external link click using Tauri opener
  const handleExternalLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
  };

  const displayError = formError || error;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.account")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.account.description")}
        </p>
      </div>

      {isAuthenticated && user ? (
        <>
          {/* User Profile Card */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.username} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {(user.displayName || user.username || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{user.displayName || user.username}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.username && user.displayName && (
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t("settings.account.actions")}
            </h3>

            <button
              onClick={() => handleExternalLink("https://viben-web.vercel.app/profile")}
              className="flex w-full items-center justify-between rounded-xl border bg-card p-3 transition-colors duration-200 hover:bg-muted"
            >
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{t("settings.account.editProfile")}</span>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              onClick={logout}
              disabled={isLoading}
              className="flex w-full items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-destructive transition-colors duration-200 hover:bg-destructive/10"
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-4 w-4" />
                <span className="text-sm">{t("auth.signOut")}</span>
              </div>
            </button>
          </div>
        </>
      ) : (
        /* Not Logged In - OAuth Flow */
        <div className="rounded-xl border bg-card p-6">
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
                              "mt-1 text-xs transition-colors text-center max-w-[70px]",
                              index <= currentStep ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {t(step.labelKey)}
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
                      <input
                        type="text"
                        placeholder={t("auth.oauthCodePlaceholder")}
                        value={oauthCode}
                        onChange={(e) => setOauthCode(e.target.value)}
                        disabled={isLoading}
                        className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
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
                  <p className="font-medium">{t("settings.account.oauth.timeout")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("settings.account.oauth.timeoutHint")}</p>
                </div>
                <Button onClick={startOAuthFlow} className="w-full max-w-xs">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("settings.account.oauth.retry")}
                </Button>
              </div>
            ) : oauthStatus === "error" ? (
              /* Error state */
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t("settings.account.oauth.error")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("settings.account.oauth.errorHint")}</p>
                </div>
                <Button onClick={startOAuthFlow} className="w-full max-w-xs">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("settings.account.oauth.retry")}
                </Button>
              </div>
            ) : oauthStatus === "success" ? (
              /* Success state (brief transition) */
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t("settings.account.oauth.success")}</p>
                </div>
              </div>
            ) : (
              /* Idle state - GitHub login */
              <div className="flex flex-col items-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Github className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">{t("settings.account.notLoggedIn")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("settings.account.loginBenefits")}
                  </p>
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

      {/* Trading Accounts */}
      <TradingAccountsSection />
    </div>
  );
}
