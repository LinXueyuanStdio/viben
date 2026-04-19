/**
 * CreatePageDialog Component
 *
 * Dialog for creating new workspace pages.
 * Supports all page types: static, markdown, server, proxy
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Globe,
  Server,
  Network,
  Loader2,
  FolderPlus,
  AlertCircle,
  Smile,
  Book,
  Settings,
  Home,
  Star,
  Heart,
  Bookmark,
  Folder,
  File,
  Image,
  Music,
  Video,
  Code,
  Database,
  Cloud,
  Link,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCreatePage, usePageTemplates } from "@/hooks/use-pages";
import { toast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PageType, CreatePageParams } from "@/lib/gateway/types/page";

// =============================================================================
// Icon Options
// =============================================================================

const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: "file-text", icon: FileText },
  { name: "file", icon: File },
  { name: "folder", icon: Folder },
  { name: "book", icon: Book },
  { name: "code", icon: Code },
  { name: "globe", icon: Globe },
  { name: "home", icon: Home },
  { name: "star", icon: Star },
  { name: "heart", icon: Heart },
  { name: "bookmark", icon: Bookmark },
  { name: "settings", icon: Settings },
  { name: "image", icon: Image },
  { name: "music", icon: Music },
  { name: "video", icon: Video },
  { name: "database", icon: Database },
  { name: "cloud", icon: Cloud },
  { name: "link", icon: Link },
  { name: "smile", icon: Smile },
];

// =============================================================================
// Types
// =============================================================================

export interface CreatePageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspacePath: string;
  /** Parent slug for creating subpages */
  parentSlug?: string;
  /** Callback on successful creation */
  onSuccess?: (slug: string) => void;
}

interface PageTypeOption {
  type: PageType;
  icon: React.ElementType;
  label: string;
  description: string;
}

// =============================================================================
// Constants
// =============================================================================

const PAGE_TYPE_OPTIONS: PageTypeOption[] = [
  {
    type: "static",
    icon: FileText,
    label: "page.type.static",
    description: "page.type.staticDescription",
  },
  {
    type: "markdown",
    icon: Globe,
    label: "page.type.markdown",
    description: "page.type.markdownDescription",
  },
  {
    type: "server",
    icon: Server,
    label: "page.type.server",
    description: "page.type.serverDescription",
  },
  {
    type: "proxy",
    icon: Network,
    label: "page.type.proxy",
    description: "page.type.proxyDescription",
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-") // Replace non-alphanumeric (except Chinese) with dash
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing dashes
}

// =============================================================================
// Main Component
// =============================================================================

export function CreatePageDialog({
  open,
  onOpenChange,
  workspacePath,
  parentSlug,
  onSuccess,
}: CreatePageDialogProps) {
  const { t } = useTranslation();
  const createPageMutation = useCreatePage();
  const { data: templates } = usePageTemplates(workspacePath);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("file-text");
  const [pageType, setPageType] = useState<PageType>("static");

  // Type-specific fields
  const [file, setFile] = useState("index.html");
  const [command, setCommand] = useState("npm run dev");
  const [port, setPort] = useState("5173");
  const [url, setUrl] = useState("");

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManuallyEdited && name) {
      const baseSlug = generateSlug(name);
      setSlug(parentSlug ? `${parentSlug}/${baseSlug}` : baseSlug);
    }
  }, [name, parentSlug, slugManuallyEdited]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setSlug(parentSlug ? `${parentSlug}/` : "");
      setSlugManuallyEdited(false);
      setDescription("");
      setIcon("file-text");
      setPageType("static");
      setFile("index.html");
      setCommand("npm run dev");
      setPort("5173");
      setUrl("");
    }
  }, [open, parentSlug]);

  // Load template defaults when type changes
  useEffect(() => {
    const template = templates?.find((t) => t.type === pageType);
    if (template?.default_config) {
      const config = template.default_config;
      if ("file" in config && config.file) setFile(config.file);
      if ("command" in config && config.command) setCommand(config.command);
      if ("port" in config && config.port) setPort(String(config.port));
    }
  }, [pageType, templates]);

  // Build full slug with parent
  const fullSlug = useMemo(() => {
    if (parentSlug && !slug.startsWith(parentSlug)) {
      return `${parentSlug}/${slug}`;
    }
    return slug;
  }, [parentSlug, slug]);

  // Validate form
  const isValid = useMemo(() => {
    if (!name.trim() || !slug.trim()) return false;
    if (pageType === "static" && !file.trim()) return false;
    if (pageType === "server" && (!command.trim() || !port.trim())) return false;
    if (pageType === "proxy" && !url.trim()) return false;
    return true;
  }, [name, slug, pageType, file, command, port, url]);

  // Handle slug manual edit
  const handleSlugChange = useCallback((value: string) => {
    setSlug(value);
    setSlugManuallyEdited(true);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!isValid) return;

    const params: CreatePageParams = {
      workspace_path: workspacePath,
      slug: fullSlug,
      name: name.trim(),
      description: description.trim() || undefined,
      icon: icon || undefined,
      type: pageType,
    };

    // Add type-specific fields
    if (pageType === "static") {
      params.file = file.trim();
    } else if (pageType === "markdown") {
      params.file = "content.md";
    } else if (pageType === "server") {
      params.command = command.trim();
      params.port = parseInt(port, 10);
    } else if (pageType === "proxy") {
      params.url = url.trim();
    }

    try {
      await createPageMutation.mutateAsync(params);
      toast.success(t("page.createSuccess", "Page created successfully"));
      onOpenChange(false);
      onSuccess?.(fullSlug);
    } catch (err) {
      console.error("Failed to create page:", err);
      toast.error(t("page.createFailed", "Failed to create page"));
    }
  }, [
    isValid,
    workspacePath,
    fullSlug,
    name,
    description,
    icon,
    pageType,
    file,
    command,
    port,
    url,
    createPageMutation,
    t,
    onOpenChange,
    onSuccess,
  ]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            {parentSlug
              ? t("page.createSubpage", "Create Subpage")
              : t("page.createPage", "Create Page")}
          </DialogTitle>
          <DialogDescription>
            {parentSlug
              ? t("page.createSubpageDescription", "Create a new subpage under {{parent}}", { parent: parentSlug })
              : t("page.createPageDescription", "Create a new page in the workspace")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Page Type Selection */}
          <div className="space-y-2">
            <Label>{t("page.pageType", "Page Type")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAGE_TYPE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = pageType === option.type;
                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => setPageType(option.type)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 mt-0.5 shrink-0",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "text-sm font-medium",
                          isSelected ? "text-primary" : "text-foreground"
                        )}
                      >
                        {t(option.label)}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {t(option.description)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name + Icon */}
          <div className="space-y-2">
            <Label htmlFor="page-name">{t("page.name", "Name")}</Label>
            <div className="flex items-center gap-2">
              {/* Icon Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                      "hover:bg-muted/50 transition-colors"
                    )}
                  >
                    {(() => {
                      const IconComponent = ICON_OPTIONS.find(i => i.name === icon)?.icon ?? FileText;
                      return <IconComponent className="h-4 w-4" />;
                    })()}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-2" align="start">
                  <div className="grid grid-cols-6 gap-1">
                    {ICON_OPTIONS.map((opt) => {
                      const IconComp = opt.icon;
                      return (
                        <button
                          key={opt.name}
                          type="button"
                          onClick={() => setIcon(opt.name)}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded hover:bg-muted",
                            icon === opt.name && "bg-primary/10 text-primary"
                          )}
                        >
                          <IconComp className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <Input
                id="page-name"
                placeholder={t("page.namePlaceholder", "My Page")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="flex-1"
              />
            </div>
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="page-slug">{t("page.slug", "Slug")}</Label>
            <Input
              id="page-slug"
              placeholder={t("page.slugPlaceholder", "my-page")}
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t("page.slugHint", "URL path: /pages/{{slug}}/", { slug: fullSlug || "..." })}
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="page-description">
              {t("page.description", "Description")}
              <span className="ml-1 text-muted-foreground">({t("common.optional", "Optional")})</span>
            </Label>
            <Textarea
              id="page-description"
              placeholder={t("page.descriptionPlaceholder", "A brief description of this page")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Type-specific fields */}
          {pageType === "static" && (
            <div className="space-y-2">
              <Label htmlFor="page-file">{t("page.entryFile", "Entry File")}</Label>
              <Input
                id="page-file"
                placeholder="index.html"
                value={file}
                onChange={(e) => setFile(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          )}

          {pageType === "server" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="page-command">{t("page.startCommand", "Start Command")}</Label>
                <Input
                  id="page-command"
                  placeholder="npm run dev"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="page-port">{t("page.port", "Port")}</Label>
                <Input
                  id="page-port"
                  placeholder="5173"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  type="number"
                  min={1}
                  max={65535}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {t("page.serverHint", "The server will be started when you view the page.")}
                </p>
              </div>
            </>
          )}

          {pageType === "proxy" && (
            <div className="space-y-2">
              <Label htmlFor="page-url">{t("page.targetUrl", "Target URL")}</Label>
              <Input
                id="page-url"
                placeholder="http://localhost:3000"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createPageMutation.isPending}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createPageMutation.isPending}
          >
            {createPageMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.creating", "Creating...")}
              </>
            ) : (
              t("common.create", "Create")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreatePageDialog;
