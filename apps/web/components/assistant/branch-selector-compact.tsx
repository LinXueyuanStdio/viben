"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import {
  CheckIcon,
  ChevronDown,
  ChevronsUpDown,
  GitBranch,
  PlusIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/swr";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type BranchSelectorCompactVariant = "default" | "sessionFooter";

interface BranchSelectorCompactProps {
  owner: string;
  repo: string;
  value: string | null;
  isNewBranch: boolean;
  onChange: (branch: string | null, isNewBranch: boolean) => void;
  variant?: BranchSelectorCompactVariant;
}

interface BranchesResponse {
  branches: string[];
  defaultBranch: string;
}

export function BranchSelectorCompact({
  owner,
  repo,
  value,
  isNewBranch,
  onChange,
  variant = "default",
}: BranchSelectorCompactProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());

  const autoSelectedKeyRef = useRef<string | null>(null);

  const branchesUrl =
    owner && repo
      ? `/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&limit=50${
          deferredSearchQuery
            ? `&query=${encodeURIComponent(deferredSearchQuery)}`
            : ""
        }`
      : null;

  const { data, isLoading, isValidating } = useSWR<BranchesResponse>(
    branchesUrl,
    fetcher,
  );

  const branches = data?.branches ?? [];
  const defaultBranch = data?.defaultBranch ?? "main";
  const isBranchLoading = isLoading || isValidating;

  useEffect(() => {
    if (!owner || !repo) return;

    const key = `${owner}/${repo}`;
    if (data && !value && !isNewBranch && autoSelectedKeyRef.current !== key) {
      autoSelectedKeyRef.current = key;
      onChange(null, true);
    }
  }, [data, value, isNewBranch, onChange, owner, repo]);

  useEffect(() => {
    setSearchQuery("");
  }, [owner, repo]);

  const handleSelectBranch = (branch: string) => {
    onChange(branch, false);
    setSearchQuery("");
    setOpen(false);
  };

  const handleSelectNewBranch = () => {
    onChange(null, true);
    setSearchQuery("");
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearchQuery("");
    }
  };

  const getDisplayText = () => {
    if (isBranchLoading) return t("assistant.branch.loading");
    if (isNewBranch) return t("assistant.repo.newBranchAuto");
    return value || defaultBranch || "main";
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={true}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
            variant === "sessionFooter"
              ? "h-8 w-auto min-w-0 border-0 bg-transparent px-2 text-xs"
              : "w-full border border-input bg-background/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-400 dark:hover:border-white/20 dark:hover:bg-white/[0.06] dark:hover:text-neutral-300",
          )}
        >
          {variant === "default" && (
            <GitBranch className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1 truncate text-left">{getDisplayText()}</span>
          {variant === "sessionFooter" ? (
            <ChevronsUpDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0",
          variant === "sessionFooter"
            ? "w-72"
            : "w-[var(--radix-popover-trigger-width)]",
        )}
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={t("assistant.branch.searchBranches")}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isBranchLoading
                ? t("assistant.branch.loading")
                : deferredSearchQuery
                  ? t("assistant.repo.noMatchingBranches")
                  : t("assistant.branch.noBranchesFound")}
            </CommandEmpty>
            <CommandGroup>
              {branches.map((branch) => (
                <CommandItem
                  key={branch}
                  value={branch}
                  onSelect={() => handleSelectBranch(branch)}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      value === branch && !isNewBranch
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="truncate">{branch}</span>
                  {branch === defaultBranch && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t("assistant.branch.defaultBadge")}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handleSelectNewBranch}>
                <CheckIcon
                  className={cn(
                    "mr-2 size-4",
                    isNewBranch ? "opacity-100" : "opacity-0",
                  )}
                />
                <PlusIcon className="mr-2 size-4" />
                {t("assistant.repo.newBranchAutoGenerated")}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
