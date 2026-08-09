"use client";

import {
  BookIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  LockIcon,
  RefreshCw,
  UserIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGitHubConnectionStatus } from "@/hooks/assistant/use-github-connection-status";
import { useInstallationRepos } from "@/hooks/assistant/use-installation-repos";
import { useSession } from "@/hooks/assistant/use-session";
import { buildGitHubReconnectUrl } from "@/lib/github/urls";
import { cn } from "@/lib/utils";

interface Installation {
  installationId: number;
  accountLogin: string;
  accountType: "User" | "Organization";
  repositorySelection: "all" | "selected";
  installationUrl: string | null;
}

const installationSchema = z.object({
  installationId: z.number(),
  accountLogin: z.string(),
  accountType: z.enum(["User", "Organization"]),
  repositorySelection: z.enum(["all", "selected"]),
  installationUrl: z.string().nullable(),
});

const installationsSchema = z.array(installationSchema);

function getCurrentPathWithSearch(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function RepoSelector({
  onRepoSelect,
}: {
  onRepoSelect: (owner: string, repo: string) => void;
}) {
  const { t } = useTranslation();
  const { hasGitHub } = useSession();
  const { reconnectRequired } = useGitHubConnectionStatus({
    enabled: hasGitHub,
  });
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [ownersLoading, setOwnersLoading] = useState(true);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [debouncedRepoSearch, setDebouncedRepoSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGitHubInstall = useCallback(() => {
    const params = new URLSearchParams({
      next: getCurrentPathWithSearch(),
    });
    window.location.href = `/api/github/app/install?${params.toString()}`;
  }, []);

  const startGitHubReconnect = useCallback(() => {
    window.location.href = buildGitHubReconnectUrl(getCurrentPathWithSearch());
  }, []);

  const selectedInstallation = installations.find(
    (installation) => installation.accountLogin === selectedOwner,
  );

  const {
    repos,
    isLoading: reposLoading,
    error: reposError,
    refresh: refreshRepos,
  } = useInstallationRepos({
    installationId: selectedInstallation?.installationId ?? null,
    query: debouncedRepoSearch,
    limit: 25,
  });

  useEffect(() => {
    const loadInstallations = async () => {
      if (reconnectRequired) {
        setInstallations([]);
        setSelectedOwner("");
        setError(null);
        setOwnersLoading(false);
        return;
      }

      setOwnersLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/github/installations");
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const parsed = z
            .object({ error: z.string().optional() })
            .safeParse(data);
          setError(parsed.success ? (parsed.data.error ?? "") : "");
          if (!parsed.success || !parsed.data.error) {
            setError(t("assistant.repo.connectGitHubToAccessRepos"));
          }
          return;
        }

        const json = await response.json();
        const parsed = installationsSchema.safeParse(json);
        if (!parsed.success) {
          setError(t("assistant.repo.failedToLoadInstallations"));
          return;
        }

        setInstallations(parsed.data);
        setSelectedOwner(parsed.data[0]?.accountLogin ?? "");
      } catch {
        setError(t("assistant.repo.failedToLoadGitHubData"));
      } finally {
        setOwnersLoading(false);
      }
    };

    loadInstallations();
  }, [reconnectRequired]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshRepos();
    } catch (refreshError) {
      console.error("Failed to refresh repositories:", refreshError);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshRepos]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedRepoSearch(repoSearch.trim());
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [repoSearch]);

  useEffect(() => {
    setRepoSearch("");
  }, [selectedOwner]);

  const handleOwnerSelect = (ownerLogin: string) => {
    setSelectedOwner(ownerLogin);
    setSelectedRepo("");
    setOwnerOpen(false);
  };

  const handleRepoSelect = (repoName: string) => {
    setSelectedRepo(repoName);
    onRepoSelect(selectedOwner, repoName);
    setRepoOpen(false);
  };

  if (reconnectRequired) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">
          {t("assistant.repo.savedConnectionNoLongerValid")}
        </p>
        <Button onClick={startGitHubReconnect}>
          {t("assistant.repo.reconnectGitHub")}
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={startGitHubInstall}>
          {t("assistant.repo.continueOnGitHub")}
        </Button>
      </div>
    );
  }

  if (!ownersLoading && installations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground">
          {t("assistant.repo.installAppToChooseRepoAccess")}
        </p>
        <Button onClick={startGitHubInstall}>
          {t("assistant.repo.chooseRepositories")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-expanded={ownerOpen}
            className="w-48 justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <UserIcon className="size-4 shrink-0" />
              {ownersLoading ? (
                <span className="text-muted-foreground">
                  {t("assistant.repo.loading")}
                </span>
              ) : selectedOwner ? (
                <span className="truncate">{selectedOwner}</span>
              ) : (
                <span className="text-muted-foreground">
                  {t("assistant.repo.selectAccount")}
                </span>
              )}
            </div>
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0">
          <Command>
            <CommandInput placeholder={t("assistant.repo.searchAccounts")} />
            <CommandList>
              <CommandEmpty>
                {ownersLoading
                  ? t("assistant.repo.loading")
                  : t("assistant.repo.noAccountsFound")}
              </CommandEmpty>
              <CommandGroup>
                {installations.map((installation) => (
                  <CommandItem
                    key={installation.installationId}
                    value={installation.accountLogin}
                    onSelect={() =>
                      handleOwnerSelect(installation.accountLogin)
                    }
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 size-4",
                        selectedOwner === installation.accountLogin
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <span className="truncate">
                      {installation.accountLogin}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Popover open={repoOpen} onOpenChange={setRepoOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-expanded={repoOpen}
            className="w-64 justify-between"
            disabled={!selectedOwner}
          >
            <div className="flex items-center gap-2 truncate">
              <BookIcon className="size-4 shrink-0" />
              {reposLoading ? (
                <span className="text-muted-foreground">
                  {t("assistant.repo.loading")}
                </span>
              ) : selectedRepo ? (
                <span className="truncate">{selectedRepo}</span>
              ) : (
                <span className="text-muted-foreground">
                  {t("assistant.repo.selectRepository")}
                </span>
              )}
            </div>
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0">
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
            <span>
              {t("assistant.repo.showingReposFor", { owner: selectedOwner })}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw
                className={cn("size-3", isRefreshing && "animate-spin")}
              />
              {isRefreshing
                ? t("assistant.repo.refreshing")
                : t("assistant.repo.refresh")}
            </button>
          </div>
          <Command>
            <CommandInput
              placeholder={t("assistant.repo.searchRepositories")}
              value={repoSearch}
              onValueChange={setRepoSearch}
            />
            <CommandList>
              <CommandEmpty>
                {reposError
                  ? reposError
                  : reposLoading
                    ? t("assistant.repo.loading")
                    : t("assistant.repo.noRepositoriesFound")}
              </CommandEmpty>
              <CommandGroup>
                {repos.slice(0, 25).map((repo) => (
                  <CommandItem
                    key={repo.full_name}
                    value={repo.name}
                    onSelect={() => handleRepoSelect(repo.name)}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 size-4",
                        selectedRepo === repo.name
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <span className="truncate">{repo.name}</span>
                    {repo.private && (
                      <LockIcon className="ml-auto size-3 text-muted-foreground" />
                    )}
                  </CommandItem>
                ))}
                {repos.length === 25 && !debouncedRepoSearch && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {t("assistant.repo.showingFirst25Results")}
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
