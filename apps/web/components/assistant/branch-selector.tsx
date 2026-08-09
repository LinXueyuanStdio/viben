"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  GitBranchIcon,
  PlusIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface BranchSelectorProps {
  owner: string;
  repo: string;
  value: string;
  onChange: (branch: string) => void;
  disabled?: boolean;
}

interface BranchesResponse {
  branches: string[];
  defaultBranch: string;
}

export function BranchSelector({
  owner,
  repo,
  value,
  onChange,
  disabled,
}: BranchSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  // Use refs to avoid dependency issues in useEffect
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!owner || !repo) {
      setBranches([]);
      setError(null);
      return;
    }

    const fetchBranches = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
        );
        if (!response.ok) {
          throw new Error(t("assistant.branch.fetchError"));
        }
        const data = (await response.json()) as BranchesResponse;
        setBranches(data.branches);
        setDefaultBranch(data.defaultBranch);
        // Auto-select default branch if no value is set
        if (!valueRef.current || valueRef.current === "main") {
          onChangeRef.current(data.defaultBranch);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("assistant.branch.fetchError"),
        );
        setBranches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, [owner, repo]);

  const handleSelectBranch = (branch: string) => {
    onChange(branch);
    setOpen(false);
    setCreatingNew(false);
  };

  const handleCreateNew = () => {
    setCreatingNew(true);
  };

  const handleSubmitNewBranch = () => {
    if (newBranchName.trim()) {
      onChange(newBranchName.trim());
      setNewBranchName("");
      setCreatingNew(false);
      setOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmitNewBranch();
    } else if (e.key === "Escape") {
      setCreatingNew(false);
    }
  };

  const isDisabled = disabled || !owner || !repo;

  if (creatingNew) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={newBranchName}
          onChange={(e) => setNewBranchName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("assistant.branch.enterBranchName")}
          className="w-48"
        />
        <Button
          size="sm"
          onClick={handleSubmitNewBranch}
          disabled={!newBranchName.trim()}
        >
          {t("assistant.branch.use")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setCreatingNew(false)}>
          {t("assistant.branch.cancel")}
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isDisabled}
        >
          <div className="flex items-center gap-2 truncate">
            <GitBranchIcon className="size-4 shrink-0" />
            {loading ? (
              <span className="text-muted-foreground">
                {t("assistant.branch.loading")}
              </span>
            ) : value ? (
              <span className="truncate">{value}</span>
            ) : (
              <span className="text-muted-foreground">
                {t("assistant.branch.selectBranch")}
              </span>
            )}
          </div>
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={t("assistant.branch.searchBranches")} />
          <CommandList>
            <CommandEmpty>
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : (
                t("assistant.branch.noBranchesFound")
              )}
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
                      value === branch ? "opacity-100" : "opacity-0",
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
              <CommandItem onSelect={handleCreateNew}>
                <PlusIcon className="mr-2 size-4" />
                {t("assistant.branch.createNewBranch")}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
