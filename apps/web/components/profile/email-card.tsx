"use client";

import { useTranslation } from "react-i18next";
import { Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmailCardProps {
  email: string;
}

export function EmailCard({ email }: EmailCardProps) {
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">{t("profile.email.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("profile.email.description")}
          </p>
        </div>
        {/* 后续支持多邮箱时启用 */}
        <Button type="button" variant="outline" size="sm" disabled>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("common.add")}
        </Button>
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
