"use client";

import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";

interface EmailCardProps {
  email: string;
}

export function EmailCard({ email }: EmailCardProps) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">{t("profile.email.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("profile.email.description")}
        </p>
      </div>
      <div className="px-6 py-3">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">{email}</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {t("profile.email.primary")}
          </span>
        </div>
      </div>
    </section>
  );
}
