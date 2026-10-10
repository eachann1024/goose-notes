import { isMacPlatform, type PlatformKind } from "@/lib/utils";
import {
  FIXED_CLOSE_SHORTCUT,
  FIXED_SPLIT_SHORTCUTS,
  getFixedAppShortcuts,
} from "@/lib/fixed-app-shortcuts";
import { LOCAL_FOLDER_FILE_SHORTCUTS } from "@/lib/local-folder-file-actions";

export // Electron 桌面端（仅本地模式）：设置-快捷键页多出「桌面全局快捷键」分区；Electron 不出现。
// 单元测试没有 vite define，用 typeof 兜底避免模块加载即 ReferenceError。
const isElectronHost =
  typeof __HOST_TARGET__ !== "undefined" && __HOST_TARGET__ === "electron";

export interface SettingsShortcutsProps {
  closeTabShortcut: string;
  setCloseTabShortcut: (shortcut: string) => void;
  searchPanelCloseShortcut: string;
  setSearchPanelCloseShortcut: (shortcut: string) => void;
  appShortcuts: Record<string, string>;
  setAppShortcut: (id: string, shortcut: string) => void;
  resetAppShortcuts: () => void;
  singleTabMode: boolean;
}

export const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

export const FIXED_APP_SHORTCUTS = getFixedAppShortcuts();

export /** 单标签模式下 UI 与热键均禁用的自定义动作，不参与冲突占用。 */
const TAB_ONLY_APP_SHORTCUT_IDS = new Set(["newTab"]);

export const ALWAYS_FIXED_SHORTCUT_VALUES = [
  FIXED_CLOSE_SHORTCUT,
  ...Object.values(FIXED_SPLIT_SHORTCUTS).filter(Boolean),
  FIXED_APP_SHORTCUTS.openSettings,
  FIXED_APP_SHORTCUTS.editorFindOpen,
  "Mod+Alt+F",
  FIXED_APP_SHORTCUTS.newNote,
  "Mod+G",
  "Mod+Shift+G",
  "Mod+=",
  "Mod+-",
  "Mod+0",
  "F3",
  "Shift+F3",
  // 浏览器/编辑器固定行为不可被自定义动作覆盖。
  "Mod+S",
  "Mod+1",
  "Mod+2",
  "Mod+3",
  "Mod+A",
  "Mod+Z",
  "Mod+Shift+Z",
  "Mod+Y",
  LOCAL_FOLDER_FILE_SHORTCUTS.moveItem,
  LOCAL_FOLDER_FILE_SHORTCUTS.openInExternalApp,
  LOCAL_FOLDER_FILE_SHORTCUTS.revealInFileManager,
  LOCAL_FOLDER_FILE_SHORTCUTS.openInTerminal,
  LOCAL_FOLDER_FILE_SHORTCUTS.copyFilePath,
  ...(isElectronHost ? ["Mod+Shift+N", "Mod+W"] : []),
  ...(isElectronHost && isMacPlatform() ? ["Mod+Shift+W"] : []),
];

export /** 仅多标签模式生效的固定快捷键。 */
const TAB_ONLY_FIXED_SHORTCUT_VALUES = [
  "Mod+W",
  FIXED_APP_SHORTCUTS.reopenTab,
  ...Array.from({ length: 6 }, (_, index) => `Mod+${index + 4}`),
  "Ctrl+Tab",
  "Ctrl+Shift+Tab",
];

export const FIXED_SHORTCUT_VALUES = [
  ...ALWAYS_FIXED_SHORTCUT_VALUES,
  ...TAB_ONLY_FIXED_SHORTCUT_VALUES,
];

export const FIXED_SHORTCUTS: Array<{
  label: string;
  shortcut: string;
  tabOnly?: boolean;
  desktopOnly?: boolean;
  platforms?: PlatformKind[];
}> = [
  { label: "新建笔记", shortcut: FIXED_APP_SHORTCUTS.newNote },
  { label: "新建窗口", shortcut: "Mod+Shift+N", desktopOnly: true },
  { label: "页内查找", shortcut: FIXED_APP_SHORTCUTS.editorFindOpen },
  { label: "页内替换", shortcut: "Mod+Alt+F" },
  { label: "侧栏聚焦时收起其它文件夹（优先于关闭笔记）", shortcut: "Escape" },
  {
    label: "恢复最近关闭的标签页",
    shortcut: FIXED_APP_SHORTCUTS.reopenTab,
    tabOnly: true,
  },
  {
    label: "按关闭顺序关闭当前内容（桌面）",
    shortcut: "Mod+W",
    desktopOnly: true,
  },
  {
    label: "关闭窗口（macOS）",
    shortcut: "Mod+Shift+W",
    desktopOnly: true,
    platforms: ["mac"],
  },
  { label: "打开设置", shortcut: FIXED_APP_SHORTCUTS.openSettings },
  { label: "切换侧栏视图（本地 / 大纲 / 搜索）", shortcut: "Mod+1~3" },
  {
    label: "切换标签页（4~8 对应序号，9 到最后）",
    shortcut: "Mod+4~9",
    tabOnly: true,
  },
  { label: "循环切换标签页", shortcut: "Ctrl+Tab", tabOnly: true },
  { label: "反向循环切换标签页", shortcut: "Ctrl+Shift+Tab", tabOnly: true },
  { label: "查找下一处", shortcut: "Mod+G" },
  { label: "查找上一处", shortcut: "Mod+Shift+G" },
  { label: "字号放大", shortcut: "Mod+=" },
  { label: "字号缩小", shortcut: "Mod+-" },
  { label: "重置字号", shortcut: "Mod+0" },
  { label: "继续查找（F3）", shortcut: "F3" },
  { label: "反向继续查找", shortcut: "Shift+F3" },
  { label: "手动保存（本地文件立即写盘）", shortcut: "Mod+S" },
  { label: "加粗", shortcut: "Mod+B" },
  { label: "斜体", shortcut: "Mod+I" },
  { label: "下划线", shortcut: "Mod+U" },
  { label: "行内代码", shortcut: "Mod+E" },
  { label: "删除线", shortcut: "Mod+Shift+S" },
  { label: "标题 1～3 级", shortcut: "Mod+Alt+1~3" },
  { label: "上移编辑块", shortcut: "Alt+ArrowUp" },
  { label: "下移编辑块", shortcut: "Alt+ArrowDown" },
  { label: "选区加入 AI 对话（AI 开启时）", shortcut: "Mod+Shift+U" },
  { label: "重命名侧栏页面", shortcut: "F2" },
  { label: "删除侧栏选中页面", shortcut: "Mod+Backspace" },
  {
    label: "移动本地文件/文件夹",
    shortcut: LOCAL_FOLDER_FILE_SHORTCUTS.moveItem,
  },
  {
    label: "用外部应用打开当前本地文件",
    shortcut: LOCAL_FOLDER_FILE_SHORTCUTS.openInExternalApp,
  },
  {
    label: "在文件管理器中显示当前本地文件",
    shortcut: LOCAL_FOLDER_FILE_SHORTCUTS.revealInFileManager,
  },
  {
    label: "在终端中打开当前本地文件",
    shortcut: LOCAL_FOLDER_FILE_SHORTCUTS.openInTerminal,
  },
  {
    label: "复制当前文件路径",
    shortcut: LOCAL_FOLDER_FILE_SHORTCUTS.copyFilePath,
  },
  { label: "全选", shortcut: "Mod+A" },
  { label: "撤销", shortcut: "Mod+Z" },
  { label: "重做", shortcut: "Mod+Shift+Z" },
  { label: "重做（Windows）", shortcut: "Mod+Y", platforms: ["windows"] },
];

export const FIXED_SHORTCUT_PLATFORMS: { id: PlatformKind; label: string }[] = [
  { id: "mac", label: "macOS" },
  { id: "windows", label: "Windows" },
  { id: "linux", label: "Linux" },
];
