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
          "home-main-title-desc":
            "A 3rd party extension tool for the app Fog of World",
          "home-editor-title": "Editor",
          "home-editor-desc":
            "A tool for visualizing and editing the data of Fog of World App.",
          "home-time-machine-title": "Time Machine (Coming soon)",
          "home-time-machine-desc":
            "A service for backup and preserve history of the data of Fog of World App.",
          "add-data-source": "Add data source",
          "edit-data-source": "Edit data source",
          "data-source-title": "Data source",
          "data-share-link": "Share link",
          "data-share-link-help": "How to get share link",
          "data-sync-interval": "Sync interval",
          "data-share-link-every": "every",
          "data-sync-interval-hours": "hours",
          "data-sync-interval-day": "day",
          "data-sync-interval-days": "days",
          "data-sync-interval-week": "week",
          "data-form-submit": "Submit",
          "snapshot-table-title": "Snapshots",
          "snapshot-table-date": "Date",
          "snapshot-table-source": "Source",
          "snapshot-table-source-sync": "Sync",
          "snapshot-table-source-upload": "Upload",
          "snapshot-table-download": "Download",
          "snapshot-table-view": "View",
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
          "add-data-source": "添加数据源",
          "edit-data-source": "编辑数据源",
          "data-source-title": "数据源",
          "data-share-link": "共享链接",
          "data-share-link-help": "如何获取共享链接",
          "data-sync-interval": "定时同步",
          "data-share-link-every": "每隔",
          "data-sync-interval-hours": "小时",
          "data-sync-interval-day": "天",
          "data-sync-interval-days": "天",
          "data-sync-interval-week": "周",
          "data-form-submit": "提交",
          "snapshot-table-title": "快照列表",
          "snapshot-table-date": "时间",
          "snapshot-table-source": "来源",
          "snapshot-table-source-sync": "同步",
          "snapshot-table-source-upload": "上传",
          "snapshot-table-download": "下载",
          "snapshot-table-view": "查看",
        },
      },
    },
  });
export default i18n;
