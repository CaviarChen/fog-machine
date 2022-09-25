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
          "home-main-title": "Fog Machine",
          "home-main-title-desc": "A 3rd party extension tool for the app Fog of World",
          "home-editor-title": "Editor",
          "home-editor-desc": "A tool for visualizing and editing the data of Fog of World App.",
          "home-time-machine-title": "Time Machine (Coming soon)",
          "home-time-machine-desc": "A service for backup and preserve history of the data of Fog of World App.",
        },
      },
      zh: {
        translation: {
          "home-main-title": "迷雾机器",
          "home-main-title-desc": "世界迷雾 的第三方扩展工具",
          "home-editor-title": "编辑器",
          "home-editor-desc": "世界迷雾数据的可视化编辑工具。",
          "home-time-machine-title": "时光机 (即将上线)",
          "home-time-machine-desc": "世界迷雾数据快照及历史数据管理服务。",
        },
      },
    },
  });
export default i18n;
