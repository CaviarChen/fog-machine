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
          "home-memolanes-title": "MemoLanes",
          "home-memolanes-desc":
            "MemoLanes is an open-source travel visualization app designed to help users better organize their travel memories.",
          "home-help-title": "Help",
          "home-theme-dark": "Dark",
          "home-theme-light": "Light",
          "add-data-source": "Add data source",
          "edit-data-source": "Edit data source",
          "data-source-title": "Data source",
          "data-share-link": "Share link",
          "data-share-link-help": "How to get share link",
          "data-sync-interval": "Sync interval",
          "data-share-link-every": "every",
          "data-upload-title": "Upload Data",
          "data-upload-select-date": "Select Date",
          "data-upload-note": "Note(optional)",
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
          "snapshot-list-note": "Note",
          "snapshot-list-source": "Source",
          "snapshot-list-source-sync": "Sync",
          "snapshot-list-source-upload": "Upload",
          "snapshot-list-download": "Download",
          "snapshot-list-export-mldx": "Export MemoLanes Archive",
          "snapshot-list-export-mldx-prompt":
            "This feature will read all snapshots stored in your Fog Machine, then convert and optimize them one by one. After that, they will be merged into an archive file that can be read by MemoLanes (mldx).\nSpecifically:\n1. All snapshots will be processed in the order of snapshot time and converted into journeys in MemoLanes.\n2. Each journey's date is based on the snapshot time and your current time zone.\n3. We subtract the previous snapshot from each snapshot, so each journey will only contain the diff.\n4. Area that exists in a snapshot but not in the final snapshot will be removed. If you've used the eraser, ensure the final snapshot doesn't contain areas you don't want.\n5. Snapshots that are too small will be ignored.",
          "snapshot-list-export-mldx-confirm": "Export",
          "snapshot-list-view": "View",
          "snapshot-list-note-edit": "Edit Note",
          "snapshot-list-note-edit-err-tolong":
            "Note is too long, please shorten it",
          "snapshot-list-note-edit-err": "Unknown Error",
          "snapshot-list-upload": "Upload",
          "snapshot-list-delete": "Delete",
          "snapshot-list-delete-title": "Delete snapshot",
          "snapshot-list-delete-confirm": "Confirm",
          "snapshot-list-delete-cancel": "Cancel",
          "snapshot-list-delete-prompt":
            "This item will be deleted immediately. You can't undo this action！",
          "log-list-timestamp": "Sync time",
          "log-list-snapshot-id": "Snapshot id",
          "log-list-succeed": "Succeedd",
          "log-list-details": "Details",
          "error-page-404-text": "Page not found (404)",
          "error-page-404-button": "Back to home",
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
          "home-memolanes-title": "MemoLanes",
          "home-memolanes-desc":
            "MemoLanes（迹忆）是一款开源的旅行可视化记录应用，旨在帮助用户更好的整理旅行记忆。",
          "home-help-title": "帮助",
          "home-theme-dark": "夜间模式",
          "home-theme-light": "日间模式",
          "add-data-source": "添加数据源",
          "edit-data-source": "编辑数据源",
          "data-source-title": "数据源",
          "data-share-link": "共享链接",
          "data-share-link-help": "如何获取共享链接",
          "data-sync-interval": "定时同步",
          "data-share-link-every": "每隔",
          "data-upload-title": "上传",
          "data-upload-select-date": "选择时间",
          "data-upload-note": "备注（可选）",
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
          "snapshot-list-note": "备注",
          "snapshot-list-source": "来源",
          "snapshot-list-source-sync": "同步",
          "snapshot-list-source-upload": "上传",
          "snapshot-list-download": "下载",
          "snapshot-list-export-mldx": "导出迹忆归档",
          "snapshot-list-export-mldx-prompt":
            "此功能将读取你在 迷雾机器 中的所有快照并逐一转换、优化并合并成为可供 迹忆 导入的归档文件（mldx）。\n其中：\n1. 所有快照会按时间顺序逐一处理，转换成 迹忆 的旅程。\n2. 每个旅程的日期基于快照时间以及你当前的时区。\n3. 每个快照会减去上一个快照中的数据，使得每个旅程之包含差异数据。\n4. 每个快照中不存在于最后一个快照的数据将被去除。如果你使用过橡皮擦，只需要保证最后的快照中不包含你不需要的数据即可。\n5. 过小的快照将会被忽略。",
          "snapshot-list-export-mldx-confirm": "导出",
          "snapshot-list-view": "查看",
          "snapshot-list-note-edit": "编辑备注",
          "snapshot-list-note-edit-err-tolong": "备注过长，请修改",
          "snapshot-list-note-edit-err": "未知错误",
          "snapshot-list-upload": "上传",
          "snapshot-list-delete": "删除",
          "snapshot-list-delete-title": "删除快照",
          "snapshot-list-delete-confirm": "确认",
          "snapshot-list-delete-cancel": "取消",
          "snapshot-list-delete-prompt": "此快照将被删除，该操作无法撤销！",
          "log-list-timestamp": "快照日期",
          "log-list-snapshot-id": "快照ID",
          "log-list-succeed": "任务结果",
          "log-list-details": "日志",
          "error-page-404-text": "页面无法找到 (404)",
          "error-page-404-button": "返回主页",
        },
      },
    },
  });
export default i18n;
