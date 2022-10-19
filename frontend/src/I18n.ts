import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import moment from "moment";
import "moment/locale/zh-cn";

i18n.on("languageChanged", (lng: string) => {
  moment.locale(lng == "zh" ? "zh-ch" : "en");
});

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init(
    {
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
            "data-upload-title": "Upload Data",
            "data-upload-select-date": "Select Date",
            "data-upload-prompt":
              "Click or Drag a .zip file to this area to upload",
            "data-upload-uploading": "uploading",
            "data-upload-success": "success!",
            "error-upload-timestamp":
              "You cannot select a time that is in the future.",
            "error-upload-token":
              "Failed to load uploaded file, please reupload and try again.",
            "error-data-share-link": "The given share link is invalid",
            "error-data-folder-structure": "The given share link is invalid",
            "error-Unknown": "Unknown Error",
            "error-title": "Error",
            "success-title": "Success",
            "sync-status-running": "Running",
            "sync-status-paused": "Paused",
            "sync-status-stopped": "Stopped",
            "sync-nextSyncMsg": "Last success sync: ",
            "sync-nextSyncMsg-none": "none",
            "sync-button-pause": "Pause",
            "sync-button-start": "Start",
            "sync-button-view-Log": "View Log",
            "sync-button-edit": "Edit",
            "data-disclaimer": "Disclaimer",
            "data-form-submit": "Submit",
            "data-form-delete": "Delete",
            "login-main-title": "Login",
            "login-warning-title": "Warning",
            "login-warning-text":
              "This service is in alpha testing. Use it at your own risk.",
            "login-main-github": "Sign in with Github",
            "snapshot-table-title": "Snapshots",
            "snapshot-table-date": "Date",
            "snapshot-table-source": "Source",
            "snapshot-table-source-sync": "Sync",
            "snapshot-table-source-upload": "Upload",
            "snapshot-table-download": "Download",
            "snapshot-table-view": "View",
            "snapshot-table-upload": "Upload",
            "snapshot-table-delete": "Delete",
            "snapshot-table-delete-title": "Delete snapshot",
            "snapshot-table-delete-confirm": "Confirm",
            "snapshot-table-delete-cancel": "Cancel",
            "snapshot-table-delete-prompt":
              "This item will be deleted immediately. You can't undo this action！",
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
            "data-upload-title": "上传",
            "data-upload-select-date": "选择时间",
            "data-upload-prompt": "点击上传或拖拽.zip文件上传",
            "data-upload-uploading": "上传中",
            "data-upload-success": "上传成功!",
            "error-upload-timestamp": "不能选择未来的时间.",
            "error-upload-token": "上传文件失败，请重试.",
            "error-data-share-link": "共享链接无效",
            "error-data-folder-structure": "共享链接无效",
            "error-Unknown": "未知错误",
            "error-title": "错误",
            "success-title": "成功",
            "sync-status-running": "运行中",
            "sync-status-paused": "暂停",
            "sync-status-stopped": "停止",
            "sync-nextSyncMsg": "上次同步时间: ",
            "sync-nextSyncMsg-none": "无",
            "sync-button-pause": "暂停",
            "sync-button-start": "开始",
            "sync-button-view-Log": "日志",
            "sync-button-edit": "编辑",
            "data-disclaimer": "免责声明",
            "data-form-submit": "提交",
            "data-form-delete": "删除",
            "login-main-title": "登录",
            "login-warning-title": "警告",
            "login-warning-text":
              "该服务正在进行alpha测试。使用时请自行承担风险。",
            "login-main-github": "使用Github登录",
            "snapshot-table-title": "快照列表",
            "snapshot-table-date": "时间",
            "snapshot-table-source": "来源",
            "snapshot-table-source-sync": "同步",
            "snapshot-table-source-upload": "上传",
            "snapshot-table-download": "下载",
            "snapshot-table-view": "查看",
            "snapshot-table-upload": "上传",
            "snapshot-table-delete": "删除",
            "snapshot-table-delete-title": "删除快照",
            "snapshot-table-delete-confirm": "确认",
            "snapshot-table-delete-cancel": "取消",
            "snapshot-table-delete-prompt": "此快照将被删除，该操作无法撤销！",
          },
        },
      },
    },
    () => {
      moment.locale(i18n.language);
    }
  );
export default i18n;
