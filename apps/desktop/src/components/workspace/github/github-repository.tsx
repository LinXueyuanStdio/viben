/**
 * GitHub Repository Component
 *
 * Handles repository connection UI:
 * - Display connected repository
 * - Auto-detect from .git
 * - Manual repository selection
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  GitBranch,
  Link,
  Unlink,
  Search,
  ExternalLink,
  Loader2,
  FolderGit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { GitHubRepository as GitHubRepo, GitHubRepositoryConfig } from "@/lib/github-client";

interface GitHubRepositoryProps {
  repository: GitHubRepositoryConfig | null;
  detectedRepository: GitHubRepo | null;
  loading: boolean;
  error: string | null;
  onConnect: (owner: string, name: string) => Promise<GitHubRepo | null>;
  onDisconnect: () => Promise<void>;
}

export function GitHubRepository({
  repository,
  detectedRepository,
  loading,
  error,
  onConnect,
  onDisconnect,
}: GitHubRepositoryProps) {
  const { t } = useTranslation();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [manualOwner, setManualOwner] = useState("");
  const [manualName, setManualName] = useState("");
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnectDetected = async () => {
    if (!detectedRepository) return;

    setConnectLoading(true);
    setConnectError(null);

    try {
      await onConnect(detectedRepository.owner, detectedRepository.name);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setConnectLoading(false);
    }
  };

  const handleConnectManual = async () => {
    if (!manualOwner.trim() || !manualName.trim()) {
      setConnectError(t("workspaceSettings.github.repo.ownerNameRequired"));
      return;
    }

    setConnectLoading(true);
    setConnectError(null);

    try {
      const repo = await onConnect(manualOwner.trim(), manualName.trim());
      if (repo) {
        setConnectDialogOpen(false);
        setManualOwner("");
        setManualName("");
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await onDisconnect();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Connected state
  if (repository) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FolderGit className="h-4 w-4" />
            {t("workspaceSettings.github.repo.title")}
          </h3>
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            <Unlink className="h-4 w-4 mr-2" />
            {t("workspaceSettings.github.repo.disconnect")}
          </Button>
        </div>

        <div className="p-3 border rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-medium">{repository.full_name}</div>
            <a
              href={repository.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            {t("workspaceSettings.github.repo.defaultBranch")}: {repository.default_branch}
          </div>
        </div>
      </div>
    );
  }

  // Disconnected state
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <FolderGit className="h-4 w-4" />
        {t("workspaceSettings.github.repo.title")}
      </h3>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {/* Auto-detected repository */}
        {detectedRepository && (
          <div className="flex items-center justify-between p-3 border rounded-lg border-primary/30 bg-primary/5">
            <div>
              <div className="text-sm font-medium">
                {t("workspaceSettings.github.repo.detected")}
              </div>
              <div className="text-sm text-muted-foreground">
                {detectedRepository.full_name}
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleConnectDetected}
              disabled={connectLoading}
            >
              {connectLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Link className="h-4 w-4 mr-2" />
              {t("workspaceSettings.github.repo.connect")}
            </Button>
          </div>
        )}

        {/* Manual connection */}
        <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
          <DialogTrigger asChild>
            <div className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <div>
                <div className="text-sm font-medium">
                  {t("workspaceSettings.github.repo.manual")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("workspaceSettings.github.repo.manualDescription")}
                </div>
              </div>
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("workspaceSettings.github.repo.connectDialogTitle")}
              </DialogTitle>
              <DialogDescription>
                {t("workspaceSettings.github.repo.connectDialogDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="repo-owner">
                  {t("workspaceSettings.github.repo.owner")}
                </Label>
                <Input
                  id="repo-owner"
                  placeholder="owner"
                  value={manualOwner}
                  onChange={(e) => setManualOwner(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repo-name">
                  {t("workspaceSettings.github.repo.name")}
                </Label>
                <Input
                  id="repo-name"
                  placeholder="repository"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </div>
              {connectError && (
                <div className="text-sm text-destructive">{connectError}</div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConnectDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={handleConnectManual} disabled={connectLoading}>
                {connectLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("workspaceSettings.github.repo.connect")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
