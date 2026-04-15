import * as React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle, X, Terminal } from "lucide-react";
import { GithubIcon as Github } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Check if running in development mode
const isDev = import.meta.env.DEV;

interface LoginDialogProps {
  /** Custom trigger element. If not provided, uses default button */
  trigger?: React.ReactNode;
  /** Callback when login succeeds */
  onSuccess?: () => void;
}

/**
 * Login dialog component with GitHub OAuth.
 *
 * Features:
 * - GitHub OAuth button
 * - Error display
 * - Loading states
 * - Dev mode OAuth code input
 *
 * @example
 * ```tsx
 * <LoginDialog onSuccess={() => console.log('Logged in!')} />
 *
 * // With custom trigger
 * <LoginDialog trigger={<Button>Sign In</Button>} />
 * ```
 */
export function LoginDialog({ trigger, onSuccess }: LoginDialogProps) {
  const { t } = useTranslation();
  const { loginWithGitHub, handleOAuthCallback, isLoading, error, clearError, setLoading, isAuthenticated } = useAuth();

  const [open, setOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // OAuth waiting state
  const [isWaitingOAuth, setIsWaitingOAuth] = React.useState(false);

  // Dev mode: manual OAuth code input
  const [showDevOAuth, setShowDevOAuth] = React.useState(false);
  const [oauthCode, setOauthCode] = React.useState("");

  // Close dialog when authenticated
  React.useEffect(() => {
    if (isAuthenticated && open) {
      setOpen(false);
      onSuccess?.();
    }
  }, [isAuthenticated, open, onSuccess]);

  // Clear errors when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setFormError(null);
      clearError();
      setShowDevOAuth(false);
      setOauthCode("");
      setIsWaitingOAuth(false);
    }
  }, [open, clearError]);

  // Reset OAuth waiting state when auth completes
  React.useEffect(() => {
    if (isAuthenticated) {
      setIsWaitingOAuth(false);
    }
  }, [isAuthenticated]);

  const handleGitHubLogin = async () => {
    try {
      setIsWaitingOAuth(true);
      await loginWithGitHub();
      // OAuth flow continues in browser
      // Dialog stays open until callback completes
      // In dev mode, show the manual code input after opening browser
      if (isDev) {
        setShowDevOAuth(true);
      }
    } catch {
      setIsWaitingOAuth(false);
      // Error is handled by the hook
    }
  };

  const cancelOAuth = () => {
    setIsWaitingOAuth(false);
    setShowDevOAuth(false);
    setLoading(false);
    clearError();
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
      // Dialog will close via useEffect when isAuthenticated becomes true
    } catch {
      // Error is handled by the hook
    }
  };

  const displayError = formError || error;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            {t("auth.signIn")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("auth.signInTitle")}</DialogTitle>
          <DialogDescription>{t("auth.signInDescription")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Error display */}
          {displayError && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg p-3",
                "bg-destructive/10 text-destructive text-sm"
              )}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{displayError}</span>
            </div>
          )}

          {/* GitHub OAuth button */}
          {isWaitingOAuth ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="text-sm">
                  <p className="font-medium">{t("auth.waitingForOAuth")}</p>
                  <p className="text-muted-foreground">{t("auth.completeInBrowser")}</p>
                </div>
              </div>

              {/* Dev mode: Manual OAuth code input */}
              {isDev && showDevOAuth && (
                <form onSubmit={handleDevOAuthSubmit} className="space-y-3">
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

              <Button
                type="button"
                variant="outline"
                onClick={cancelOAuth}
                className="w-full"
              >
                <X className="mr-2 h-4 w-4" />
                {t("common.cancel")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* GitHub icon and description */}
              <div className="flex flex-col items-center space-y-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <Github className="h-7 w-7" />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {t("auth.githubLoginDescription")}
                </p>
              </div>

              <Button
                type="button"
                onClick={handleGitHubLogin}
                disabled={isLoading}
                className="w-full"
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
      </DialogContent>
    </Dialog>
  );
}
