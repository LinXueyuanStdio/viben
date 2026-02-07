/**
 * Documents Page
 *
 * Displays the Viben documentation website in an iframe.
 */

import { useTranslation } from "react-i18next";

const DOCS_URL = "http://linxueyuan.online/viben/docs";

export function DocumentsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      <iframe
        src={DOCS_URL}
        className="h-full w-full border-0"
        title={t("nav.documents")}
      />
    </div>
  );
}
