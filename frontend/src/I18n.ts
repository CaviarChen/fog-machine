import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import moment from "moment";
import "moment/locale/zh-cn";

function setMomentLanguage() {
  moment.locale(i18n.resolvedLanguage == "zh" ? "zh-ch" : "en");
}

i18n.on("languageChanged", setMomentLanguage);

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
            "A tool for visualizing and editing Fog of World data",
          "home-time-machine-title": "Time Machine (beta)",
          "home-time-machine-desc":
            "A service for snapshotting and preserving history of Fog of World data",
          "home-help-title": "Help",
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
          "error-unknown": "Unknown Error",
          "error-title": "Error",
          "success-title": "Success",
          "sync-status-running": "Running",
          "sync-status-paused": "Paused",
          "sync-status-stopped": "Stopped",
          "sync-next-sync-message": "Last success sync: ",
          "sync-next-sync-message-none": "none",
          "sync-button-pause": "Pause",
          "sync-button-start": "Start",
          "sync-button-view-Log": "View Log",
          "sync-button-edit": "Edit",
          "data-disclaimer": "Disclaimer",
          "data-disclaimer-content":
            'By doing this, you are allowing "Fog Machine" to read and save your "Fog of World" data. We are trying our best to make sure your data is safe and secure, but as a free and open source service, it comes with no warranties, use at your own risk.',
          "data-form-submit": "Submit",
          "data-form-delete": "Delete",
          "login-main-title": "Login",
          "login-main-github": "Sign in with Github",
          "snapshot-list-title": "Snapshots",
          "snapshot-list-date": "Date",
          "snapshot-list-source": "Source",
          "snapshot-list-source-sync": "Sync",
          "snapshot-list-source-upload": "Upload",
          "snapshot-list-download": "Download",
          "snapshot-list-view": "View",
          "snapshot-list-upload": "Upload",
          "snapshot-list-delete": "Delete",
          "snapshot-list-delete-title": "Delete snapshot",
          "snapshot-list-delete-confirm": "Confirm",
          "snapshot-list-delete-cancel": "Cancel",
          "snapshot-list-delete-prompt":
            "This item will be deleted immediately. You can't undo this action！",
        },
      },
      zh: {
        translation: {
          "home-main-title": "迷雾机器",
          "home-main-title-desc": "世界迷雾 的第三方扩展工具",
          "home-editor-title": "编辑器",
          "home-editor-desc": "世界迷雾数据的可视化编辑工具。",
          "home-time-machine-title": "时光机 (beta)",
          "home-time-machine-desc": "世界迷雾数据快照及历史数据管理服务。",
          "home-help-title": "帮助",
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
          "error-unknown": "未知错误",
          "error-title": "错误",
          "success-title": "成功",
          "sync-status-running": "运行中",
          "sync-status-paused": "暂停",
          "sync-status-stopped": "停止",
          "sync-next-sync-message": "上次同步时间: ",
          "sync-next-sync-message-none": "无",
          "sync-button-pause": "暂停",
          "sync-button-start": "开始",
          "sync-button-view-Log": "日志",
          "sync-button-edit": "编辑",
          "data-disclaimer": "免责声明",
          "data-disclaimer-content":
            '此操作将授予"迷雾机器"读取并储存你的"世界迷雾"数据的权限。我们会竭尽全力保障你的数据安全及隐私，但是作为一个免费的开源服务，我们无法提供担保，请自负风险。',
          "data-form-submit": "提交",
          "data-form-delete": "删除",
          "login-main-title": "登录",
          "login-main-github": "使用Github登录",
          "snapshot-list-title": "快照列表",
          "snapshot-list-date": "时间",
          "snapshot-list-source": "来源",
          "snapshot-list-source-sync": "同步",
          "snapshot-list-source-upload": "上传",
          "snapshot-list-download": "下载",
          "snapshot-list-view": "查看",
          "snapshot-list-upload": "上传",
          "snapshot-list-delete": "删除",
          "snapshot-list-delete-title": "删除快照",
          "snapshot-list-delete-confirm": "确认",
          "snapshot-list-delete-cancel": "取消",
          "snapshot-list-delete-prompt": "此快照将被删除，该操作无法撤销！",
        },
      },
    },
  });
export default i18n;
