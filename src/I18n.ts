import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    debug: true,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    resources: {
      en: {
        translation: {
          "main-title": "FogMachine",
          import: "Import",
          "import-description": "Import data from [Fog of World]",
          export: "Export",
          "export-description": "Export data in [Fog of World] format",
          language: "Language",
        },
      },
      zh: {
        translation: {
          "main-title": "迷雾机器",
          import: "导入",
          "import-description": "从 [世界迷雾] 中导入数据",
          export: "导出",
          "export-description": "以 [世界迷雾] 的格式导出数据",
          language: "语言",
        },
      },
    },
  });
export default i18n;
