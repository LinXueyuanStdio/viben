/**
 * GitHub Auth Component
 *
 * Handles GitHub authentication UI:
 * - Display authentication status
 * - gh CLI authentication
 * - PAT authentication
 * - Sign out
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  X,
  Terminal,
  Key,
  LogOut,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { GitHubAuthStatus, GitHubUser } from "@/lib/github-client";

interface GitHubAuthProps {
  status: GitHubAuthStatus | null;
  loading: boolean;
  error: string | null;
  onAuthenticateGhCli: () => Promise<GitHubUser | null>;
  onAuthenticatePAT: (token: string) => Promise<GitHubUser | null>;
  onSignOut: () => Promise<void>;
}

export function GitHubAuth({
  status,
  loading,
  error,
  onAuthenticateGhCli,
  onAuthenticatePAT,
  onSignOut,
}: GitHubAuthProps) {
  const { t } = useTranslation();
  const [patDialogOpen, setPATDialogOpen] = useState(false);
  const [patToken, setPATToken] = useState("");
  const [patLoading, setPATLoading] = useState(false);
  const [patError, setPATError] = useState<string | null>(null);

  const isAuthenticated = status?.authenticated ?? false;
  const user = status?.user;
  const authType = status?.auth_type;
  const ghCliAvailable = status?.gh_cli_available ?? false;
  const ghCliLoggedIn = status?.gh_cli_logged_in ?? false;

  const handleGhCliAuth = async () => {
    await onAuthenticateGhCli();
  };

  const handlePATAuth = async () => {
    if (!patToken.trim()) {
      setPATError(t("workspaceSettings.github.auth.patRequired"));
      return;
    }

    setPATLoading(true);
    setPATError(null);

    try {
      const user = await onAuthenticatePAT(patToken.trim());
      if (user) {
        setPATDialogOpen(false);
        setPATToken("");
      }
    } catch (err) {
      setPATError(err instanceof Error ? err.message : t("workspaceSettings.github.auth.patFailed"));
    } finally {
      setPATLoading(false);
    }
  };

  const handleSignOut = async () => {
    await onSignOut();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Authenticated state
  if (isAuthenticated && user) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {t("workspaceSettings.github.auth.title")}
          </h3>
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            {t("workspaceSettings.github.auth.connected")}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar_url} alt={user.login} />
              <AvatarFallback>{user.login[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{user.name || user.login}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                @{user.login}
                <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                  {authType === "gh_cli" ? "gh CLI" : "PAT"}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            {t("workspaceSettings.github.auth.signOut")}
          </Button>
        </div>
      </div>
    );
  }

  // Unauthenticated state
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">
          {t("workspaceSettings.github.auth.title")}
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <X className="h-4 w-4" />
          {t("workspaceSettings.github.auth.notConnected")}
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {/* gh CLI Authentication */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium text-sm">
                {t("workspaceSettings.github.auth.ghCli")}
              </div>
              <div className="text-xs text-muted-foreground">
                {ghCliAvailable
                  ? ghCliLoggedIn
                    ? t("workspaceSettings.github.auth.ghCliLoggedIn")
                    : t("workspaceSettings.github.auth.ghCliNotLoggedIn")
                  : t("workspaceSettings.github.auth.ghCliNotInstalled")}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            disabled={!ghCliAvailable || !ghCliLoggedIn}
            onClick={handleGhCliAuth}
          >
            {t("workspaceSettings.github.auth.useGhCli")}
          </Button>
        </div>

        {/* PAT Authentication */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium text-sm">
                {t("workspaceSettings.github.auth.pat")}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("workspaceSettings.github.auth.patDescription")}
              </div>
            </div>
          </div>
          <Dialog open={patDialogOpen} onOpenChange={setPATDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                {t("workspaceSettings.github.auth.usePAT")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {t("workspaceSettings.github.auth.patDialogTitle")}
                </DialogTitle>
                <DialogDescription>
                  {t("workspaceSettings.github.auth.patDialogDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="pat-token">
                    {t("workspaceSettings.github.auth.patLabel")}
                  </Label>
                  <Input
                    id="pat-token"
                    type="password"
                    placeholder="ghp_..."
                    value={patToken}
                    onChange={(e) => setPATToken(e.target.value)}
                  />
                </div>
                {patError && (
                  <div className="text-sm text-destructive">{patError}</div>
                )}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,read:user,read:org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  {t("workspaceSettings.github.auth.createPAT")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPATDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button onClick={handlePATAuth} disabled={patLoading}>
                  {patLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t("workspaceSettings.github.auth.authenticate")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
