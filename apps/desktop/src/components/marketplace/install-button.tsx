import { Check, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type InstallState = "not-installed" | "installing" | "installed" | "update-available" | "updating";

interface InstallButtonProps {
  state: InstallState;
  onInstall: () => void;
  onUpdate?: () => void;
  disabled?: boolean;
  className?: string;
}

export function InstallButton({
  state,
  onInstall,
  onUpdate,
  disabled = false,
  className,
}: InstallButtonProps) {
  const { t } = useTranslation();

  const getButtonContent = () => {
    switch (state) {
      case "not-installed":
        return {
          icon: <Download className="h-4 w-4" />,
          text: t("marketplace.install"),
          variant: "default" as const,
          onClick: onInstall,
        };
      case "installing":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: t("marketplace.installing"),
          variant: "secondary" as const,
          onClick: undefined,
        };
      case "installed":
        return {
          icon: <Check className="h-4 w-4" />,
          text: t("common.installed"),
          variant: "outline" as const,
          onClick: undefined,
        };
      case "update-available":
        return {
          icon: <RefreshCw className="h-4 w-4" />,
          text: t("marketplace.update"),
          variant: "default" as const,
          onClick: onUpdate || onInstall,
        };
      case "updating":
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: t("marketplace.updating"),
          variant: "secondary" as const,
          onClick: undefined,
        };
    }
  };

  const { icon, text, variant, onClick } = getButtonContent();
  const isDisabled = disabled || state === "installing" || state === "updating" || state === "installed";

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={isDisabled}
      className={cn("min-w-[100px]", className)}
    >
      {icon}
      <span className="ml-1">{text}</span>
    </Button>
  );
}
