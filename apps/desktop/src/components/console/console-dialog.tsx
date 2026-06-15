import { useState, useCallback } from "react";
import { Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConsoleTerminal } from "./console-terminal";
import { cn } from "@/lib/utils";

interface ConsoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConsoleDialog({ open, onOpenChange }: ConsoleDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-4xl w-[85vw] h-[70vh] p-0 flex flex-col overflow-hidden",
          "bg-background border-border/40 rounded-xl shadow-2xl"
        )}
      >
        <DialogHeader className="px-4 py-2.5 shrink-0 border-b border-border/20">
          <DialogTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Terminal className="h-3.5 w-3.5" />
            {t("nav.console")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {open && <ConsoleTerminal className="h-full" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ConsoleButtonProps {
  className?: string;
  onClick?: () => void;
}

export function ConsoleButton({ className, onClick }: ConsoleButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleClick = useCallback(() => {
    setOpen(true);
    onClick?.();
  }, [onClick]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={className}
      >
        <Terminal className="h-4 w-4 shrink-0 transition-colors duration-200 group-hover:text-primary" />
        <span>{t("nav.console")}</span>
      </button>
      <ConsoleDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
