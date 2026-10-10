import type { SettingsTab, SettingsTabConfig } from "../settings/types";
import { usePages } from "@/stores/usePages";
import * as GooseIcons from "@/components/ui/icons";

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  sidebarContainer: HTMLElement | null;
  mainContainer: HTMLElement | null;
}

export const SETTINGS_TABS: SettingsTabConfig[] = [
  { id: "appearance", label: "外观与主题", icon: GooseIcons.Laptop },
  { id: "general", label: "通用", icon: GooseIcons.Settings },
  { id: "shortcuts", label: "快捷键", icon: GooseIcons.Keyboard },
  { id: "local-folder", label: "本地文件夹", icon: GooseIcons.FolderOpen },
  { id: "git-sync", label: "Git 同步", icon: GooseIcons.GitBranch },
  { id: "ai", label: "AI 助手", icon: GooseIcons.Sparkles },
  { id: "data", label: "数据与备份", icon: GooseIcons.Database },
];

export // 设置侧栏鹅应用：图标使用各应用随包提供的 logo.png
const GOOSE_APPS = [
  {
    id: "goose-quicknote",
    name: "鹅的小窗",
    icon: "./apps/goose-quicknote.png",
    storeQuery: "鹅的小窗",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E5%B0%8F%E7%AA%97/",
  },
  {
    id: "goose-marks",
    name: "鹅的书签",
    icon: "./apps/goose-marks.png",
    storeQuery: "鹅的书签",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E4%B9%A6%E7%AD%BE/",
  },
  {
    id: "goose-monitor",
    name: "鹅的监控",
    icon: "./apps/goose-monitor.png",
    storeQuery: "鹅的监控",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E7%9B%91%E6%8E%A7/",
  },
  {
    id: "goose-2fa",
    name: "鹅的二次验证",
    icon: "./apps/goose-2fa.png",
    storeQuery: "鹅的二次验证（2FA）",
    url: "https://www.u-tools.cn/plugins/detail/%E9%B9%85%E7%9A%84%E4%BA%8C%E6%AC%A1%E9%AA%8C%E8%AF%81%EF%BC%882FA%EF%BC%89/",
  },
];

export const SETTINGS_APPS_BANNER_ID = "settings:recommended-apps-banner";

export // Electron 桌面端（仅本地模式）：无 Electron 生态，隐藏鹅的全家桶入口。
const isElectronHost = __HOST_TARGET__ === "electron";

export const recordPreOverwriteHistory = async (id: string | undefined) => {
  if (!id) return;
  const existingPage = usePages.getState().pages[id];
  if (existingPage && existingPage.content) {
    const oldContent = existingPage.content;
    const oldWorkspaceId = existingPage.workspaceId;
    try {
      const { recordHistorySnapshot } = await import("@/lib/history/snapshot");
      await recordHistorySnapshot({
        pageId: id,
        workspaceId: oldWorkspaceId,
        content: oldContent,
        trigger: "manual",
        isMilestone: true,
        label: "备份覆盖前本地版本",
      });
    } catch (err) {
      console.error("[history] Failed to save pre-overwrite history", err);
    }
  }
};
