import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { getGooseDesktop } from "@/lib/electron/runtime"
import {
  formatShortcut,
  getPlatformKind,
  isMacPlatform,
  type PlatformKind,
} from "@/lib/utils"
import { normalizeShortcutForConflict } from "@/lib/shortcut-platform"
import {
  DEFAULT_CLOSE_TAB_SHORTCUT,
  DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT,
  DEFAULT_APP_SHORTCUTS,
  DEFAULT_WAKE_HOTKEY,
  DEFAULT_QUICKNOTE_HOTKEY,
  DEFAULT_SEARCH_HOTKEY,
  useSettings,
} from "@/stores/useSettings"
import type { DesktopHotkeyStatus } from "@/stores/settings/types"
import { SettingsSectionCard } from "./SettingsSectionCard"
import { ShortcutField } from "./ShortcutField"
import { FIXED_CLOSE_SHORTCUT, FIXED_SPLIT_SHORTCUTS, NON_CUSTOMIZABLE_APP_SHORTCUT_IDS, getFixedAppShortcuts } from "@/lib/fixed-app-shortcuts"
import { LOCAL_FOLDER_FILE_SHORTCUTS } from "@/lib/local-folder-file-actions"

// Electron 桌面端（仅本地模式）：设置-快捷键页多出「桌面全局快捷键」分区；Electron 不出现。
// 单元测试没有 vite define，用 typeof 兜底避免模块加载即 ReferenceError。
const isElectronHost =
  typeof __HOST_TARGET__ !== "undefined" && __HOST_TARGET__ === "electron"

interface SettingsShortcutsProps {
  closeTabShortcut: string
  setCloseTabShortcut: (shortcut: string) => void
  searchPanelCloseShortcut: string
  setSearchPanelCloseShortcut: (shortcut: string) => void
  appShortcuts: Record<string, string>
  setAppShortcut: (id: string, shortcut: string) => void
  resetAppShortcuts: () => void
  singleTabMode: boolean
}
const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]"

const FIXED_APP_SHORTCUTS = getFixedAppShortcuts()

/** 单标签模式下 UI 与热键均禁用的自定义动作，不参与冲突占用。 */
const TAB_ONLY_APP_SHORTCUT_IDS = new Set([
  "newTab",
])

const ALWAYS_FIXED_SHORTCUT_VALUES = [
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
]

/** 仅多标签模式生效的固定快捷键。 */
const TAB_ONLY_FIXED_SHORTCUT_VALUES = [
  "Mod+W",
  FIXED_APP_SHORTCUTS.reopenTab,
  ...Array.from({ length: 6 }, (_, index) => `Mod+${index + 4}`),
  "Ctrl+Tab",
  "Ctrl+Shift+Tab",
]

const FIXED_SHORTCUT_VALUES = [
  ...ALWAYS_FIXED_SHORTCUT_VALUES,
  ...TAB_ONLY_FIXED_SHORTCUT_VALUES,
]

export { normalizeShortcutForConflict } from "@/lib/shortcut-platform"

// Collect all currently configured shortcuts to detect conflicts
// eslint-disable-next-line react-refresh/only-export-components
export function getAllConfiguredShortcuts(
  appShortcuts: Record<string, string>,
  _closeTabShortcut: string,
  _searchPanelCloseShortcut: string,
  excludeId: string,
  isMac: PlatformKind | boolean = isMacPlatform(),
  singleTabMode = false,
  desktopHotkeys?: {
    wakeHotkey?: string
    quicknoteHotkey?: string
    searchHotkey?: string
  },
): string[] {
  const fixedValues = singleTabMode
    ? ALWAYS_FIXED_SHORTCUT_VALUES
    : FIXED_SHORTCUT_VALUES
  const shortcuts = fixedValues.map((shortcut) =>
    normalizeShortcutForConflict(shortcut, isMac),
  )
  for (const [id, s] of Object.entries(appShortcuts)) {
    if (id === excludeId || !s || NON_CUSTOMIZABLE_APP_SHORTCUT_IDS.has(id)) continue
    // 单标签模式下这些动作不注册热键，也不应占用可配置位。
    if (singleTabMode && TAB_ONLY_APP_SHORTCUT_IDS.has(id)) continue
    shortcuts.push(normalizeShortcutForConflict(s, isMac))
  }
  // 桌面全局快捷键（Electron）也参与冲突占用。
  if (excludeId !== "wake-hotkey" && desktopHotkeys?.wakeHotkey) {
    shortcuts.push(normalizeShortcutForConflict(desktopHotkeys.wakeHotkey, isMac))
  }
  if (excludeId !== "quicknote-hotkey" && desktopHotkeys?.quicknoteHotkey) {
    shortcuts.push(
      normalizeShortcutForConflict(desktopHotkeys.quicknoteHotkey, isMac),
    )
  }
  if (excludeId !== "search-hotkey" && desktopHotkeys?.searchHotkey) {
    shortcuts.push(
      normalizeShortcutForConflict(desktopHotkeys.searchHotkey, isMac),
    )
  }
  return shortcuts
}

function makeAppShortcutSetter(
  id: string,
  setAppShortcut: (id: string, shortcut: string) => void,
  appShortcuts: Record<string, string>,
  closeTabShortcut: string,
  searchPanelCloseShortcut: string,
  singleTabMode: boolean,
  desktopHotkeys?: {
    wakeHotkey?: string
    quicknoteHotkey?: string
    searchHotkey?: string
  },
) {
  return (shortcut: string) => {
    if (shortcut) {
      const existing = getAllConfiguredShortcuts(
        appShortcuts,
        closeTabShortcut,
        searchPanelCloseShortcut,
        id,
        isMacPlatform(),
        singleTabMode,
        desktopHotkeys,
      )
      if (existing.includes(normalizeShortcutForConflict(shortcut))) {
        toast.warning("快捷键冲突", {
          description: `${formatShortcut(shortcut)} 已被其他操作占用，请选择其他快捷键。`,
        })
        return
      }
    }
    setAppShortcut(id, shortcut)
  }
}

const FIXED_SHORTCUTS: Array<{
  label: string
  shortcut: string
  tabOnly?: boolean
  desktopOnly?: boolean
  platforms?: PlatformKind[]
}> = [
  { label: "新建笔记", shortcut: FIXED_APP_SHORTCUTS.newNote },
  { label: "新建窗口", shortcut: "Mod+Shift+N", desktopOnly: true },
  { label: "页内查找", shortcut: FIXED_APP_SHORTCUTS.editorFindOpen },
  { label: "页内替换", shortcut: "Mod+Alt+F" },
  { label: "侧栏聚焦时收起其它文件夹（优先于关闭笔记）", shortcut: "Escape" },
  { label: "恢复最近关闭的标签页", shortcut: FIXED_APP_SHORTCUTS.reopenTab, tabOnly: true },
  { label: "按关闭顺序关闭当前内容（桌面）", shortcut: "Mod+W", desktopOnly: true },
  { label: "关闭窗口（macOS）", shortcut: "Mod+Shift+W", desktopOnly: true, platforms: ["mac"] },
  { label: "打开设置", shortcut: FIXED_APP_SHORTCUTS.openSettings },
  { label: "切换侧栏视图（本地 / 大纲 / 搜索）", shortcut: "Mod+1~3" },
  { label: "切换标签页（4~8 对应序号，9 到最后）", shortcut: "Mod+4~9", tabOnly: true },
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
  { label: "移动本地文件/文件夹", shortcut: LOCAL_FOLDER_FILE_SHORTCUTS.moveItem },
  { label: "用外部应用打开当前本地文件", shortcut: LOCAL_FOLDER_FILE_SHORTCUTS.openInExternalApp },
  { label: "在文件管理器中显示当前本地文件", shortcut: LOCAL_FOLDER_FILE_SHORTCUTS.revealInFileManager },
  { label: "在终端中打开当前本地文件", shortcut: LOCAL_FOLDER_FILE_SHORTCUTS.openInTerminal },
  { label: "复制当前文件路径", shortcut: LOCAL_FOLDER_FILE_SHORTCUTS.copyFilePath },
  { label: "全选", shortcut: "Mod+A" },
  { label: "撤销", shortcut: "Mod+Z" },
  { label: "重做", shortcut: "Mod+Shift+Z" },
  { label: "重做（Windows）", shortcut: "Mod+Y", platforms: ["windows"] },
]

const FIXED_SHORTCUT_PLATFORMS: { id: PlatformKind; label: string }[] = [
  { id: "mac", label: "macOS" },
  { id: "windows", label: "Windows" },
  { id: "linux", label: "Linux" },
]

function KbdShortcut({
  shortcut,
  platform = getPlatformKind(),
}: {
  shortcut: string
  platform?: PlatformKind
}) {
  // 范围键仍需格式化 Mod，避免直接把内部存储值展示给用户。
  if (shortcut.includes("~")) {
    return (
      <kbd className="inline-flex items-center rounded-[6px] bg-[var(--goose-interactive-hover)] px-2 py-0.5 font-mono text-xs text-muted-foreground">
        {formatShortcut(shortcut, platform)}
      </kbd>
    )
  }
  const parts = shortcut.split("+")
  return (
    <span className="inline-flex items-center gap-0.5">
      {parts.map((part, i) => (
        <kbd
          key={`${platform}-${part}-${i}`}
          className="inline-flex items-center rounded-[6px] bg-[var(--goose-interactive-hover)] px-2 py-0.5 font-mono text-xs text-muted-foreground"
        >
          {formatShortcut(part, platform)}
        </kbd>
      ))}
    </span>
  )
}

function FixedShortcutRow({
  label,
  shortcut,
  platform,
}: {
  label: string
  shortcut: string
  platform: PlatformKind
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 ${SETTINGS_OPTION_ROW_CLASS}`}
    >
      <span className="min-w-0 text-sm text-muted-foreground">{label}</span>
      <span className="justify-self-end whitespace-nowrap">
        <KbdShortcut shortcut={shortcut} platform={platform} />
      </span>
    </div>
  )
}

/** 桌面全局快捷键状态文案（占用/无效/已关闭/错误/已生效）。 */
function desktopHotkeyStatusText(status: DesktopHotkeyStatus): {
  text: string
  isError: boolean
} {
  switch (status.state) {
    case "active":
      return { text: "已生效", isError: false }
    case "occupied":
      return {
        text: `快捷键被占用${status.message ? `：${status.message}` : ""}`,
        isError: true,
      }
    case "invalid":
      return { text: "快捷键无效，请重新录制", isError: true }
    case "disabled":
      return { text: status.message || "已关闭", isError: false }
    case "error":
      return {
        text: `注册失败${status.message ? `：${status.message}` : ""}`,
        isError: true,
      }
    default:
      return { text: "", isError: false }
  }
}

/** 「桌面全局快捷键」分区：仅 Electron 桌面端渲染。 */
function DesktopGlobalHotkeysCard({
  appShortcuts,
  closeTabShortcut,
  searchPanelCloseShortcut,
  singleTabMode,
}: {
  appShortcuts: Record<string, string>
  closeTabShortcut: string
  searchPanelCloseShortcut: string
  singleTabMode: boolean
}) {
  const desktop = useSettings((s) => s.desktop)
  const setWakeHotkey = useSettings((s) => s.setWakeHotkey)
  const setWakeHotkeyEnabled = useSettings((s) => s.setWakeHotkeyEnabled)
  const setQuicknoteHotkey = useSettings((s) => s.setQuicknoteHotkey)
  const setQuicknoteHotkeyEnabled = useSettings(
    (s) => s.setQuicknoteHotkeyEnabled,
  )
  const setSearchHotkey = useSettings((s) => s.setSearchHotkey)
  const setSearchHotkeyEnabled = useSettings((s) => s.setSearchHotkeyEnabled)
  const [macAccessibilityNeeded, setMacAccessibilityNeeded] = useState(false)

  useEffect(() => {
    const api = getGooseDesktop()
    if (!api?.getAccessibilityStatus) return
    let cancelled = false
    const refresh = () => {
      void api.getAccessibilityStatus().then((status) => {
        if (cancelled) return
        setMacAccessibilityNeeded(
          status.platform === "darwin" && !status.trusted,
        )
      })
    }
    refresh()
    window.addEventListener("focus", refresh)
    return () => {
      cancelled = true
      window.removeEventListener("focus", refresh)
    }
  }, [])

  const makeDesktopSetter = (
    excludeId: "wake-hotkey" | "quicknote-hotkey" | "search-hotkey",
    setHotkey: (shortcut: string) => void,
    setEnabled: (enabled: boolean) => void,
  ) =>
    (shortcut: string) => {
      // 清空 = 禁用
      if (!shortcut) {
        setHotkey("")
        setEnabled(false)
        return
      }
      const existing = getAllConfiguredShortcuts(
        appShortcuts,
        closeTabShortcut,
        searchPanelCloseShortcut,
        excludeId,
        isMacPlatform(),
        singleTabMode,
        {
          wakeHotkey: desktop.wakeHotkey,
          quicknoteHotkey: desktop.quicknoteHotkey,
          searchHotkey: desktop.searchHotkey,
        },
      )
      if (existing.includes(normalizeShortcutForConflict(shortcut))) {
        toast.warning("快捷键冲突", {
          description: `${formatShortcut(shortcut)} 已被其他操作占用，请选择其他快捷键。`,
        })
        return
      }
      setHotkey(shortcut)
      setEnabled(true)
    }

  const wakeStatus = desktopHotkeyStatusText(desktop.wakeHotkeyStatus)
  const quicknoteStatus = desktopHotkeyStatusText(desktop.quicknoteHotkeyStatus)
  const searchStatus = desktopHotkeyStatusText(desktop.searchHotkeyStatus)

  return (
    <SettingsSectionCard title="桌面全局快捷键">
      <p className="mb-3 text-xs text-muted-foreground">
        应用未聚焦时也可唤出。同一快捷键再按一次：已聚焦则隐藏，未聚焦则聚焦，不可见则显示。
      </p>
      {macAccessibilityNeeded && (
        <div
          className={`mb-3 flex items-center justify-between gap-4 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}
        >
          <p className="text-xs text-muted-foreground">
            macOS 需要在「系统设置 › 隐私与安全性 › 辅助功能」中允许 Goose Note，全局快捷键才能在其他应用前台时唤出主窗口和速记小窗。
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-[10px]"
            onClick={() => {
              void getGooseDesktop()?.requestAccessibility?.()
            }}
          >
            打开系统设置
          </Button>
        </div>
      )}
      <ShortcutField
        id="wake-hotkey"
        title="主窗口唤出 / 隐藏"
        description="全局唤出或隐藏 Goose Note 主窗口。"
        value={desktop.wakeHotkeyEnabled ? desktop.wakeHotkey : ""}
        onChange={makeDesktopSetter(
          "wake-hotkey",
          setWakeHotkey,
          setWakeHotkeyEnabled,
        )}
        resetValue={DEFAULT_WAKE_HOTKEY}
      />
      {wakeStatus.text && (
        <p
          className={`mt-1 pl-4 text-[11px] ${wakeStatus.isError ? "text-[var(--goose-color-danger)]" : "text-muted-foreground"}`}
        >
          {wakeStatus.text}
        </p>
      )}
      <div className="mt-2">
        <ShortcutField
          id="quicknote-hotkey"
          title="速记小窗唤出 / 隐藏"
          description="全局唤出或隐藏速记小窗，随手记录草稿。"
          value={desktop.quicknoteHotkeyEnabled ? desktop.quicknoteHotkey : ""}
          onChange={makeDesktopSetter(
            "quicknote-hotkey",
            setQuicknoteHotkey,
            setQuicknoteHotkeyEnabled,
          )}
          resetValue={DEFAULT_QUICKNOTE_HOTKEY}
        />
        {quicknoteStatus.text && (
          <p
            className={`mt-1 pl-4 text-[11px] ${quicknoteStatus.isError ? "text-[var(--goose-color-danger)]" : "text-muted-foreground"}`}
          >
            {quicknoteStatus.text}
          </p>
        )}
      </div>
      <div className="mt-2">
        <ShortcutField
          id="search-hotkey"
          title="唤出搜索面板（全局）"
          description="在其他软件中也可唤出，默认 ⌘⇧K / Ctrl+Shift+K。点击输入框修改，清空即关闭，不影响应用内快捷键。"
          value={desktop.searchHotkeyEnabled ? desktop.searchHotkey : ""}
          onChange={makeDesktopSetter(
            "search-hotkey",
            setSearchHotkey,
            setSearchHotkeyEnabled,
          )}
          resetValue={DEFAULT_SEARCH_HOTKEY}
        />
        {searchStatus.text && (
          <p
            className={`mt-1 pl-4 text-[11px] ${searchStatus.isError ? "text-[var(--goose-color-danger)]" : "text-muted-foreground"}`}
          >
            {searchStatus.text}
          </p>
        )}
      </div>
    </SettingsSectionCard>
  )
}

export function SettingsShortcuts({
  closeTabShortcut,
  setCloseTabShortcut,
  searchPanelCloseShortcut,
  setSearchPanelCloseShortcut,
  appShortcuts,
  setAppShortcut,
  resetAppShortcuts,
  singleTabMode,
}: SettingsShortcutsProps) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKind>(() => {
    const platform = getPlatformKind()
    return platform === "other" ? "windows" : platform
  })
  // zustand v5 忽略第二个 equalityFn 参数，对象选择器会导致重复渲染，故拆成原始值。
  const wakeHotkey = useSettings((s) => s.desktop.wakeHotkey)
  const quicknoteHotkey = useSettings((s) => s.desktop.quicknoteHotkey)
  const searchHotkey = useSettings((s) => s.desktop.searchHotkey)
  const desktopHotkeys = isElectronHost
    ? { wakeHotkey, quicknoteHotkey, searchHotkey }
    : undefined

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    resetAppShortcuts()
    setCloseTabShortcut(DEFAULT_CLOSE_TAB_SHORTCUT)
    setSearchPanelCloseShortcut(DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT)
    if (isElectronHost) {
      // 桌面全局快捷键一并恢复默认并重新启用
      const settings = useSettings.getState()
      settings.setWakeHotkey(DEFAULT_WAKE_HOTKEY)
      settings.setWakeHotkeyEnabled(true)
      settings.setQuicknoteHotkey(DEFAULT_QUICKNOTE_HOTKEY)
      settings.setQuicknoteHotkeyEnabled(true)
      settings.setSearchHotkey(DEFAULT_SEARCH_HOTKEY)
      settings.setSearchHotkeyEnabled(true)
    }
    setConfirmReset(false)
    toast.success("已恢复全部快捷键默认值")
  }

  const safeSetAppShortcut = (id: string) =>
    makeAppShortcutSetter(
      id,
      setAppShortcut,
      appShortcuts,
      closeTabShortcut,
      searchPanelCloseShortcut,
      singleTabMode,
      desktopHotkeys,
    )

  return (
    <div className="settings-shortcuts">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-semibold tracking-tight text-foreground">
          快捷键
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 rounded-[10px]"
          onClick={handleReset}
          onBlur={() => setConfirmReset(false)}
        >
          {confirmReset ? "再次点击确认恢复" : "恢复默认"}
        </Button>
      </div>

      <div className="settings-shortcuts-columns">
        <div className="space-y-5">
      {isElectronHost && (
        <DesktopGlobalHotkeysCard
          appShortcuts={appShortcuts}
          closeTabShortcut={closeTabShortcut}
          searchPanelCloseShortcut={searchPanelCloseShortcut}
          singleTabMode={singleTabMode}
        />
      )}

      <SettingsSectionCard title="应用内动作">
        <ShortcutField
          id="shortcut-toggle-sidebar"
          title="收起 / 展开侧栏"
          description="折叠或展开左侧导航栏，在编辑器聚焦时也可触发。"
          value={appShortcuts.toggleSidebar ?? DEFAULT_APP_SHORTCUTS.toggleSidebar}
          onChange={safeSetAppShortcut("toggleSidebar")}
          resetValue={DEFAULT_APP_SHORTCUTS.toggleSidebar}
        />
        <div className="mt-2">
          <ShortcutField
            id="shortcut-toggle-ai-panel"
            title="开关 AI 面板"
            description="展开或折叠右侧 AI 助手面板。"
            value={appShortcuts.toggleAIPanel ?? DEFAULT_APP_SHORTCUTS.toggleAIPanel}
            onChange={safeSetAppShortcut("toggleAIPanel")}
            resetValue={DEFAULT_APP_SHORTCUTS.toggleAIPanel}
          />
        </div>
        <div className="mt-2">
          <ShortcutField
            id="shortcut-open-search"
            title="唤出搜索面板（应用内）"
            description="仅在软件内生效，默认 ⌘K / Ctrl+K。点击输入框修改，清空即关闭，不影响全局快捷键。"
            value={appShortcuts.openSearch ?? DEFAULT_APP_SHORTCUTS.openSearch}
            onChange={safeSetAppShortcut("openSearch")}
            resetValue={DEFAULT_APP_SHORTCUTS.openSearch}
          />
        </div>
        <div className="mt-2">
          <ShortcutField
            id="shortcut-toggle-theme"
            title="切换深色模式"
            description="按 跟随系统 → 浅色 → 深色 循环切换主题。"
            value={appShortcuts.toggleTheme ?? DEFAULT_APP_SHORTCUTS.toggleTheme}
            onChange={safeSetAppShortcut("toggleTheme")}
            resetValue={DEFAULT_APP_SHORTCUTS.toggleTheme}
          />
        </div>
        <div className="mt-2">
          <ShortcutField
            id="shortcut-nav-back"
            title="后退"
            description="返回上一个选中的文件或浏览位置，鼠标后退键同样生效。"
            value={appShortcuts.navBack ?? DEFAULT_APP_SHORTCUTS.navBack}
            onChange={safeSetAppShortcut("navBack")}
            resetValue={DEFAULT_APP_SHORTCUTS.navBack}
          />
        </div>
        <div className="mt-2">
          <ShortcutField
            id="shortcut-nav-forward"
            title="前进"
            description="前往下一个选中的文件或浏览位置，鼠标前进键同样生效。"
            value={appShortcuts.navForward ?? DEFAULT_APP_SHORTCUTS.navForward}
            onChange={safeSetAppShortcut("navForward")}
            resetValue={DEFAULT_APP_SHORTCUTS.navForward}
          />
        </div>
        {!singleTabMode && <>
          <div className="mt-2">
          <ShortcutField
            id="shortcut-new-tab"
            title="新建标签页"
            description="打开欢迎页作为新标签页，可从中搜索或新建笔记。"
            value={appShortcuts.newTab ?? DEFAULT_APP_SHORTCUTS.newTab}
            onChange={safeSetAppShortcut("newTab")}
            resetValue={DEFAULT_APP_SHORTCUTS.newTab}
          />
          </div>
        </>}
      </SettingsSectionCard>

      <SettingsSectionCard title="分屏快捷键（固定）">
        <p className="mb-3 text-xs text-muted-foreground">
          分屏快捷键不可修改。向右分屏在编辑区较窄时会改为向下分屏。
        </p>
        <div className="space-y-1">
          {([
            ["向右分屏", FIXED_SPLIT_SHORTCUTS.splitRight],
            ["向下分屏", FIXED_SPLIT_SHORTCUTS.splitDown],
            ["焦点移到左格", FIXED_SPLIT_SHORTCUTS.splitFocusLeft],
            ["焦点移到右格", FIXED_SPLIT_SHORTCUTS.splitFocusRight],
            ["焦点移到上格", FIXED_SPLIT_SHORTCUTS.splitFocusUp],
            ["焦点移到下格", FIXED_SPLIT_SHORTCUTS.splitFocusDown],
            ["切换到上一个分屏格", FIXED_SPLIT_SHORTCUTS.splitFocusPrevious],
            ["切换到下一个分屏格", FIXED_SPLIT_SHORTCUTS.splitFocusNext],
            ["最大化 / 恢复分屏格", FIXED_SPLIT_SHORTCUTS.splitZoom],
            ["按关闭顺序关闭当前分屏格", FIXED_CLOSE_SHORTCUT],
          ]).map(([label, shortcut]) => (
            <FixedShortcutRow key={label} label={label} shortcut={shortcut} platform={getPlatformKind()} />
          ))}
        </div>
      </SettingsSectionCard>

        </div>
        <div className="space-y-5">
      <SettingsSectionCard title="关闭行为（固定）">
        <p className="mb-3 text-xs text-muted-foreground">
          按一次依次关闭：通知 → 弹窗 → 当前分屏格（如有）→ 当前标签页。
          搜索面板打开时先关闭面板，不会同时关闭笔记；编辑器内部操作优先消费 Escape。
          桌面端 {formatShortcut("Mod+W")} 保留相同关闭顺序。
        </p>
        <div className="space-y-1">
          <FixedShortcutRow label="关闭当前内容" shortcut={FIXED_CLOSE_SHORTCUT} platform={getPlatformKind()} />
          <FixedShortcutRow label="关闭搜索面板" shortcut={FIXED_CLOSE_SHORTCUT} platform={getPlatformKind()} />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="固定快捷键">
        <p className="mb-3 text-xs text-muted-foreground">
          按系统查看固定键；编辑器与侧栏快捷键只在对应位置生效。
        </p>
        <div role="group" aria-label="查看平台快捷键" className="mb-3 flex flex-wrap gap-1">
          {FIXED_SHORTCUT_PLATFORMS.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={selectedPlatform === item.id}
              onClick={() => setSelectedPlatform(item.id)}
              className={`h-8 rounded-lg px-3 text-xs focus-visible:ring-2 focus-visible:ring-ring ${selectedPlatform === item.id ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]" : "text-muted-foreground"}`}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="settings-fixed-shortcuts space-y-1" role="region" aria-label={`${FIXED_SHORTCUT_PLATFORMS.find((item) => item.id === selectedPlatform)?.label} 固定快捷键`}>
          {FIXED_SHORTCUTS.filter((item) =>
            (!singleTabMode || !item.tabOnly) &&
            (!item.desktopOnly || isElectronHost) &&
            (!item.platforms || item.platforms.includes(selectedPlatform))
          ).map((item) => (
            <FixedShortcutRow
              key={item.label}
              label={item.label}
              shortcut={item.shortcut}
              platform={selectedPlatform}
            />
          ))}
        </div>
      </SettingsSectionCard>
        </div>
      </div>
    </div>
  )
}
