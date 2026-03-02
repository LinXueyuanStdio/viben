import * as React from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* -----------------------------------------------------------------------------
 * Dialog Nesting Context - Tracks dialog depth for proper z-index stacking
 * -------------------------------------------------------------------------- */

const DialogNestingContext = React.createContext<number>(0);

function useDialogNesting() {
  return React.useContext(DialogNestingContext);
}

/* -----------------------------------------------------------------------------
 * Dialog Context
 * -------------------------------------------------------------------------- */

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  nestingLevel: number;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within a Dialog provider");
  }
  return context;
}

/* -----------------------------------------------------------------------------
 * Dialog Root
 * -------------------------------------------------------------------------- */

interface DialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function Dialog({ children, open: controlledOpen, onOpenChange }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const parentNestingLevel = useDialogNesting();
  const nestingLevel = parentNestingLevel + 1;

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <DialogContext.Provider value={{ open, setOpen, nestingLevel }}>
      <DialogNestingContext.Provider value={open ? nestingLevel : parentNestingLevel}>
        {children}
      </DialogNestingContext.Provider>
    </DialogContext.Provider>
  );
}

/* -----------------------------------------------------------------------------
 * Dialog Trigger
 * -------------------------------------------------------------------------- */

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ className, children, asChild, onClick, ...props }, ref) => {
    const { setOpen } = useDialogContext();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setOpen(true);
      onClick?.(e);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref,
        onClick: handleClick,
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        type="button"
        className={className}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);
DialogTrigger.displayName = "DialogTrigger";

/* -----------------------------------------------------------------------------
 * Dialog Portal & Overlay
 * -------------------------------------------------------------------------- */

interface DialogOverlayProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogOverlayProps>(
  ({ className, ...props }, ref) => {
    const { open, setOpen, nestingLevel } = useDialogContext();

    if (!open) return null;

    // Base z-index is 50, each nesting level adds 10
    const zIndex = 50 + (nestingLevel - 1) * 10;

    return (
      <div
        ref={ref}
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm",
          "animate-in fade-in-0",
          className
        )}
        style={{ zIndex }}
        onClick={() => setOpen(false)}
        {...props}
      />
    );
  }
);
DialogOverlay.displayName = "DialogOverlay";

/* -----------------------------------------------------------------------------
 * Dialog Content
 * -------------------------------------------------------------------------- */

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const { t } = useTranslation();
    const { open, setOpen, nestingLevel } = useDialogContext();

    // Handle escape key - only close the topmost dialog
    React.useEffect(() => {
      if (!open) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
        }
      };

      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }, [open, setOpen]);

    // Prevent body scroll when dialog is open (only for first level)
    React.useEffect(() => {
      if (nestingLevel === 1) {
        if (open) {
          document.body.style.overflow = "hidden";
        } else {
          document.body.style.overflow = "";
        }
        return () => {
          document.body.style.overflow = "";
        };
      }
    }, [open, nestingLevel]);

    if (!open) return null;

    // Base z-index is 50, each nesting level adds 10 (content is 1 higher than overlay)
    const zIndex = 50 + (nestingLevel - 1) * 10 + 1;

    return (
      <>
        <DialogOverlay />
        <div
          ref={ref}
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-lg",
            "bg-card border border-border rounded-2xl shadow-xl",
            "animate-in fade-in-0 zoom-in-95",
            "p-6",
            className
          )}
          style={{ zIndex }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          {...props}
        >
          {children}
          <button
            type="button"
            className={cn(
              "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background",
              "transition-opacity hover:opacity-100",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:pointer-events-none"
            )}
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t("common.close")}</span>
          </button>
        </div>
      </>
    );
  }
);
DialogContent.displayName = "DialogContent";

/* -----------------------------------------------------------------------------
 * Dialog Header
 * -------------------------------------------------------------------------- */

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

/* -----------------------------------------------------------------------------
 * Dialog Footer
 * -------------------------------------------------------------------------- */

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

/* -----------------------------------------------------------------------------
 * Dialog Title
 * -------------------------------------------------------------------------- */

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      "font-serif text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

/* -----------------------------------------------------------------------------
 * Dialog Description
 * -------------------------------------------------------------------------- */

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
