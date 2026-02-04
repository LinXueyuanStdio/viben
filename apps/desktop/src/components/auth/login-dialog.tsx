import * as React from "react";
import { useTranslation } from "react-i18next";
import { Github, Loader2, Mail, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LoginDialogProps {
  /** Custom trigger element. If not provided, uses default button */
  trigger?: React.ReactNode;
  /** Callback when login succeeds */
  onSuccess?: () => void;
}

/**
 * Login dialog component with email/password and GitHub OAuth options.
 *
 * Features:
 * - Email/password form with validation
 * - GitHub OAuth button
 * - Error display
 * - Loading states
 * - Remember me option
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
  const { login, loginWithGitHub, isLoading, error, clearError } = useAuth();

  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Clear errors when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setFormError(null);
      clearError();
    }
  }, [open, clearError]);

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setFormError(t("auth.emailRequired"));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError(t("auth.emailInvalid"));
      return false;
    }
    if (!password) {
      setFormError(t("auth.passwordRequired"));
      return false;
    }
    if (password.length < 6) {
      setFormError(t("auth.passwordTooShort"));
      return false;
    }
    setFormError(null);
    return true;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await login(email, password);
      setOpen(false);
      onSuccess?.();
    } catch {
      // Error is handled by the store and displayed via error state
    }
  };

  const handleGitHubLogin = async () => {
    try {
      await loginWithGitHub();
      // OAuth flow continues in browser
      // Dialog stays open until callback completes
    } catch {
      // Error is handled by the store
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
          <Button
            type="button"
            variant="outline"
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

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {t("auth.orContinueWith")}
              </span>
            </div>
          </div>

          {/* Email/password form */}
          <form onSubmit={handleEmailLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <a
                  href="https://browse-mcp.vercel.app/forgot-password"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {t("auth.forgotPassword")}
                </a>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pr-9"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2",
                    "text-muted-foreground hover:text-foreground",
                    "transition-colors"
                  )}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className={cn(
                  "h-4 w-4 rounded border-input",
                  "text-primary focus:ring-primary"
                )}
              />
              <Label htmlFor="remember" className="text-sm font-normal">
                {t("auth.rememberMe")}
              </Label>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("auth.signInWithEmail")}
            </Button>
          </form>

          {/* Sign up link */}
          <p className="text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <a
              href="https://browse-mcp.vercel.app/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {t("auth.signUp")}
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
