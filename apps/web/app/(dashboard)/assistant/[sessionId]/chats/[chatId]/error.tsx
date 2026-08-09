"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("Chat page error:", error);
  }, [error]);

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
      <p className="text-sm text-destructive">{t("assistant.page.somethingWentWrong")}</p>
      <Button variant="outline" size="sm" onClick={reset}>
        {t("assistant.page.tryAgain")}
      </Button>
    </div>
  );
}
