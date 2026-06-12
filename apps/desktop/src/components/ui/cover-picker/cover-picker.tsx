/**
 * CoverPicker Component — Notion-like
 *
 * Popover with tabs for selecting page cover:
 * - Gallery: preset gradients and solid colors
 * - Upload: local file upload
 * - Link: external URL
 */

import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { GradientGallery } from "./gradient-gallery";
import { UploadTab } from "./upload-tab";
import { LinkTab } from "./link-tab";

type CoverTab = "gallery" | "upload" | "link";

export interface CoverPickerProps {
  value?: string | null;
  onChange?: (cover: string | null) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  workspacePath?: string;
  uid?: string;
  disabled?: boolean;
  /** When provided, the popover positions relative to this element instead of using trigger. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  allowRemove?: boolean;
}

export function CoverPicker({
  value,
  onChange,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  workspacePath,
  uid,
  disabled = false,
  anchorRef,
  trigger,
  align = "start",
  allowRemove = true,
}: CoverPickerProps) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      if (!isControlled) setUncontrolledOpen(v);
      controlledOnOpenChange?.(v);
    },
    [isControlled, controlledOnOpenChange]
  );

  const [activeTab, setActiveTab] = useState<CoverTab>("gallery");

  // Reset tab when popover opens
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setActiveTab("gallery");
    }
    prevOpenRef.current = open;
  }, [open]);

  const handleGallerySelect = useCallback(
    (cover: string) => {
      onChange?.(cover);
      setOpen(false);
    },
    [onChange, setOpen]
  );

  const handleUploadSelect = useCallback(
    (url: string) => {
      onChange?.(url);
      setOpen(false);
    },
    [onChange, setOpen]
  );

  const handleLinkSelect = useCallback(
    (url: string) => {
      onChange?.(url);
      setOpen(false);
    },
    [onChange, setOpen]
  );

  const handleRemove = useCallback(() => {
    onChange?.(null);
    setOpen(false);
  }, [onChange, setOpen]);

  const hasValue = !!value;
  const showRemoveBtn = allowRemove && hasValue;

  const defaultTrigger = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      {t("coverPicker.chooseCover")}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {anchorRef ? (
        <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
      ) : (
        <PopoverTrigger asChild disabled={disabled}>
          {trigger ?? defaultTrigger}
        </PopoverTrigger>
      )}
      <PopoverContent className="w-[352px] p-0" align={align} sideOffset={4}>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as CoverTab)}
          className="w-full"
        >
          <TabsList className="w-full rounded-none p-0 h-auto">
            <TabsTrigger
              value="gallery"
              className={cn("px-3 py-2 text-xs", activeTab === "gallery" && "border-primary text-foreground")}
            >
              {t("coverPicker.gallery")}
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className={cn("px-3 py-2 text-xs", activeTab === "upload" && "border-primary text-foreground")}
            >
              {t("coverPicker.upload")}
            </TabsTrigger>
            <TabsTrigger
              value="link"
              className={cn("px-3 py-2 text-xs", activeTab === "link" && "border-primary text-foreground")}
            >
              {t("coverPicker.link")}
            </TabsTrigger>
            <div className="ml-auto flex items-center gap-0.5 px-2">
              {showRemoveBtn && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={handleRemove}
                  title={t("coverPicker.removeCover")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </TabsList>

          <TabsContent value="gallery" className="mt-0">
            <GradientGallery value={value} onSelect={handleGallerySelect} />
          </TabsContent>

          <TabsContent value="upload" className="mt-0">
            <UploadTab
              workspacePath={workspacePath}
              uid={uid}
              onSelect={handleUploadSelect}
            />
          </TabsContent>

          <TabsContent value="link" className="mt-0">
            <LinkTab onSelect={handleLinkSelect} />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
