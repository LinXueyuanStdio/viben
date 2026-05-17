import { useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageIcon } from "./page-app-icon";
import type { PageTreeNode } from "../utils";
import type { PageConfig } from "@/hooks/use-pages";

export interface FolderOverlayProps {
  folder: PageTreeNode;
  origin: { x: number; y: number } | null;
  workspacePath: string;
  onPageClick: (page: PageConfig) => void;
  onOpenInNewTab: (page: PageConfig) => void;
  onCreateSubpage: (parentSlug: string) => void;
  onDeleteClick: (page: PageConfig) => void;
  onPermissionsClick: (page: PageConfig) => void;
  onEditClick?: (page: PageConfig) => void;
  onClose: () => void;
}

export function FolderOverlay({
  folder,
  origin,
  workspacePath,
  onPageClick,
  onOpenInNewTab,
  onCreateSubpage,
  onDeleteClick,
  onPermissionsClick,
  onEditClick,
  onClose,
}: FolderOverlayProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close when clicking outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  const handleChildClick = useCallback(
    (node: PageTreeNode) => {
      onPageClick(node.page);
      onClose();
    },
    [onClose, onPageClick]
  );

  // Calculate offset from viewport center to icon position (for iPad-style expand animation)
  const offsetX = origin ? origin.x - window.innerWidth / 2 : 0;
  const offsetY = origin ? origin.y - window.innerHeight / 2 : 0;

  return (
    <motion.div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: origin
          ? `radial-gradient(600px circle at ${origin.x}px ${origin.y}px, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.6) 100%)`
          : "radial-gradient(ellipse at center, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.6) 100%)",
        backdropFilter: "blur(12px) saturate(120%)",
        WebkitBackdropFilter: "blur(12px) saturate(120%)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={handleBackdropClick}
    >
      <motion.div
        className="relative max-w-sm w-full mx-4 rounded-2xl p-5"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        }}
        initial={{ scale: 0.4, opacity: 0, x: offsetX * 0.5, y: offsetY * 0.5 }}
        animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
        exit={{ scale: 0.4, opacity: 0, x: offsetX * 0.5, y: offsetY * 0.5 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" style={{ color: "rgba(255, 255, 255, 0.6)" }} />
        </button>

        {/* Folder name */}
        <h3
          className="text-base font-semibold text-center mb-4"
          style={{
            color: "rgba(255, 255, 255, 0.9)",
            textShadow: "0 1px 3px rgba(0, 0, 0, 0.4)",
          }}
        >
          {folder.page.name}
        </h3>

        {/* Child pages grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-y-5 gap-x-2 justify-items-center">
          {folder.children.map((child) => (
            <PageIcon
              key={child.page.slug}
              node={child}
              workspacePath={workspacePath}
              onClick={() => handleChildClick(child)}
              onOpenInNewTab={onOpenInNewTab}
              onCreateSubpage={onCreateSubpage}
              onDeleteClick={onDeleteClick}
              onPermissionsClick={onPermissionsClick}
              onEditClick={onEditClick}
            />
          ))}
          {/* Add subpage button */}
          <button
            type="button"
            onClick={() => {
              onCreateSubpage(folder.page.slug);
              onClose();
            }}
            className={cn(
              "flex flex-col items-center gap-1.5 w-[76px]",
              "transition-transform duration-150 ease-out",
              "hover:scale-105 active:scale-95"
            )}
          >
            <div
              className="w-[60px] h-[60px] rounded-[14px] flex items-center justify-center"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "2px dashed rgba(255, 255, 255, 0.25)",
              }}
            >
              <Plus className="h-5 w-5" style={{ color: "rgba(255, 255, 255, 0.5)" }} />
            </div>
            <span
              className="text-[11px]"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {t("page.createSubpage")}
            </span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
