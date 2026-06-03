// packages/pet/example/src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

const resources = {
  en: { translation: en },
  "zh-CN": { translation: zhCN },
};

// 检测浏览器语言
function detectLanguage(): string {
  const browserLang = navigator.language;
  if (browserLang.startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
