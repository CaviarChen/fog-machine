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
          error: "Error",
          "error-already-imported":
            "You already imported data from [Fog of World]. Refresh the page if you want to start over.",
          "error-invalid-format": "Invalid format.",
          "error-failed-to-load-snapshot": "Failed to load snapshot.",
          "import-dialog-description":
            'All your data will be handled locally.\n\nAccept data format:\n- The "Sync" folder.\n- Files in the "Sync" folder.\n- A zip archive contains the "Sync" folder.\n\n',
          "import-dialog-drag-and-drop":
            "drag and drop [Fog of World] sync data",
          "import-dialog-select": "Select manually",
          info: "Info",
          "export-done-message":
            'Exported successfully.\n\nPlease use the "Sync" folder in the exported zip archive to replace the original folder. You also need to reset the [Fog of World] app to remove the existing data.',
          "map-type": "Map type",
          "map-type-standard": "Standard",
          "map-type-satellite": "Satellite",
          "map-type-hybrid": "Hybrid",
          "map-type-none": "None",
        },
      },
      zh: {
        translation: {
          "main-title": "迷雾机器",
          import: "导入",
          "import-description": "从 [世界迷雾] 中导入数据。",
          export: "导出",
          "export-description": "以 [世界迷雾] 的格式导出数据。",
          language: "语言",
          error: "错误",
          "error-already-imported":
            "无法多次导入 [世界迷雾] 数据。可通过刷新页面重置。",
          "error-invalid-format": "无效文件格式。",
          "error-failed-to-load-snapshot": "载入快照失败。",
          "import-dialog-description":
            '你的数据将完全在本地处理。\n\n接受的数据格式:\n- "Sync" 文件夹\n-  "Sync" 文件夹中的全部文件\n- 包含 "Sync" 文件夹的 zip 压缩包\n\n',
          "import-dialog-drag-and-drop": "拖入 [世界迷雾] 同步数据",
          "import-dialog-select": "手动选择",
          info: "提示",
          "export-done-message":
            '导出成功。\n\n请使用导出的 zip 压缩包中的 "Sync" 文件夹替换原有文件夹，并重置 [世界迷雾] app 以清除已有数据。',
          "map-type": "地图模式",
          "map-type-standard": "标准",
          "map-type-satellite": "卫星",
          "map-type-hybrid": "混合",
          "map-type-none": "无",
        },
      },
    },
  });
export default i18n;
