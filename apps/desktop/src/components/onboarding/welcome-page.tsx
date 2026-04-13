/**
 * Welcome Page Component
 *
 * First-time launch disclaimer, permission explanation, risk warning
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/pages/Welcome.tsx
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Shield, Database, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

// ============================================================================
// Types
// ============================================================================

interface WelcomePageProps {
  onAccept: () => void;
}

interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

function InfoCard({ icon, title, description, className }: InfoCardProps) {
  return (
    <Card className={cn("border-muted", className)}>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="font-medium leading-none">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Component
// ============================================================================

export function WelcomePage({ onAccept }: WelcomePageProps) {
  const { t } = useTranslation();
  const [accepted, setAccepted] = React.useState(false);

  const infoCards = [
    {
      icon: <Shield className="h-5 w-5" />,
      title: t("onboarding.welcome.cards.security.title"),
      description: t("onboarding.welcome.cards.security.description"),
    },
    {
      icon: <Database className="h-5 w-5" />,
      title: t("onboarding.welcome.cards.data.title"),
      description: t("onboarding.welcome.cards.data.description"),
    },
    {
      icon: <AlertTriangle className="h-5 w-5" />,
      title: t("onboarding.welcome.cards.risk.title"),
      description: t("onboarding.welcome.cards.risk.description"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("onboarding.welcome.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("onboarding.welcome.subtitle")}
        </p>
      </div>

      {/* Info Cards */}
      <div className="space-y-3">
        {infoCards.map((card, index) => (
          <InfoCard
            key={index}
            icon={card.icon}
            title={card.title}
            description={card.description}
          />
        ))}
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          {t("onboarding.welcome.disclaimer")}
        </p>
      </div>

      {/* Acceptance Checkbox */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="accept-terms"
          checked={accepted}
          onCheckedChange={(checked) => setAccepted(checked === true)}
          className="mt-0.5"
        />
        <label
          htmlFor="accept-terms"
          className="text-sm leading-relaxed text-muted-foreground cursor-pointer"
        >
          {t("onboarding.welcome.acceptTerms")}
        </label>
      </div>

      {/* Continue Button */}
      <Button
        onClick={onAccept}
        disabled={!accepted}
        className="w-full"
        size="lg"
      >
        {t("onboarding.welcome.continue")}
      </Button>

      {/* Links */}
      <div className="flex justify-center gap-4 text-sm">
        <a
          href="https://github.com/LinXueyuanStdio/viben"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          GitHub
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href="https://github.com/LinXueyuanStdio/viben/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          {t("onboarding.welcome.license")}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
