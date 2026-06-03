// packages/pet/example/src/components/LanguageSwitcher.tsx
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "zh-CN" : "en";
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      className="lang-switch"
      onClick={toggleLanguage}
      title={i18n.language === "en" ? "切换到中文" : "Switch to English"}
    >
      <Globe size={16} />
      <span>{i18n.language === "en" ? "中文" : "EN"}</span>
    </button>
  );
}
