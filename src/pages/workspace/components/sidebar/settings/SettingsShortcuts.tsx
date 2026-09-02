import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
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
import { getFixedAppShortcuts } from "@/lib/fixed-app-shortcuts"

// Electron 桌面端（仅本地模式）：设置-快捷键页多出「桌面全局快捷键」分区；uTools 不出现。
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
  FIXED_APP_SHORTCUTS.openSettings,
  FIXED_APP_SHORTCUTS.editorFindOpen,
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
  "Mod+A",
  "Mod+Z",
  "Mod+Shift+Z",
  "Mod+Y",
  "Mod+Shift+M",
]

/** 仅多标签模式生效的固定快捷键。 */
const TAB_ONLY_FIXED_SHORTCUT_VALUES = [
  FIXED_APP_SHORTCUTS.reopenTab,
  ...Array.from({ length: 9 }, (_, index) => `Mod+${index + 1}`),
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
  closeTabShortcut: string,
  searchPanelCloseShortcut: string,
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
    if (id === excludeId || !s) continue
    // 单标签模式下这些动作不注册热键，也不应占用可配置位。
    if (singleTabMode && TAB_ONLY_APP_SHORTCUT_IDS.has(id)) continue
    shortcuts.push(normalizeShortcutForConflict(s, isMac))
  }
  // 单标签模式隐藏「关闭标签」配置，其值不参与冲突。
  if (!singleTabMode && excludeId !== "close-tab" && closeTabShortcut) {
    shortcuts.push(normalizeShortcutForConflict(closeTabShortcut, isMac))
  }
  if (excludeId !== "search-panel-close" && searchPanelCloseShortcut) {
    shortcuts.push(normalizeShortcutForConflict(searchPanelCloseShortcut, isMac))
  }
  // 桌面全局快捷键（Electron）也参与冲突占用；excludeId 用 wake-hotkey / quicknote-hotkey。
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

function makeCloseSetter(
  excludeId: string,
  setter: (s: string) => void,
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
        excludeId,
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
    setter(shortcut)
  }
}

const FIXED_SHORTCUTS = [
  { label: "新建笔记", shortcut: FIXED_APP_SHORTCUTS.newNote },
  { label: "页内查找", shortcut: FIXED_APP_SHORTCUTS.editorFindOpen },
  { label: "恢复最近关闭的标签页（Chrome 逻辑）", shortcut: FIXED_APP_SHORTCUTS.reopenTab, tabOnly: true },
  { label: "打开设置", shortcut: FIXED_APP_SHORTCUTS.openSettings },
  { label: "切换标签页（1~8 对应序号，9 到最后）", shortcut: "Mod+1~9", tabOnly: true },
  { label: "循环切换标签页", shortcut: "Ctrl+Tab", tabOnly: true },
  { label: "反向循环切换标签页", shortcut: "Ctrl+Shift+Tab", tabOnly: true },
  { label: "查找下一处", shortcut: "Mod+G" },
  { label: "查找上一处", shortcut: "Mod+Shift+G" },
  { label: "字号放大", shortcut: "Mod+=" },
  { label: "字号缩小", shortcut: "Mod+-" },
  { label: "重置字号", shortcut: "Mod+0" },
  { label: "继续查找（F3）", shortcut: "F3" },
  { label: "反向继续查找", shortcut: "Shift+F3" },
  { label: "手动保存", shortcut: "Mod+S" },
  { label: "加粗", shortcut: "Mod+B" },
  { label: "斜体", shortcut: "Mod+I" },
  { label: "下划线", shortcut: "Mod+U" },
  { label: "行内代码", shortcut: "Mod+E" },
  { label: "链接", shortcut: "Mod+K" },
  { label: "删除线", shortcut: "Mod+Shift+S" },
  { label: "移动本地文件/文件夹", shortcut: "Mod+Shift+M" },
  { label: "全选", shortcut: "Mod+A" },
  { label: "撤销", shortcut: "Mod+Z" },
  { label: "重做", shortcut: "Mod+Shift+Z" },
  { label: "重做（Windows）", shortcut: "Mod+Y" },
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
}: {
  label: string
  shortcut: string
}) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-4 py-2.5 ${SETTINGS_OPTION_ROW_CLASS}`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      {FIXED_SHORTCUT_PLATFORMS.map((item) => (
        <span key={item.id} className="justify-self-end">
          <KbdShortcut shortcut={shortcut} platform={item.id} />
        </span>
      ))}
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
          title="唤出搜索面板"
          description="全局聚焦主窗口并打开搜索面板（不隐藏主窗口）。"
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

  const safeSetCloseTab = makeCloseSetter(
    "close-tab",
    setCloseTabShortcut,
    appShortcuts,
    closeTabShortcut,
    searchPanelCloseShortcut,
    singleTabMode,
    desktopHotkeys,
  )
  const safeSetSearchPanelClose = makeCloseSetter(
    "search-panel-close",
    setSearchPanelCloseShortcut,
    appShortcuts,
    closeTabShortcut,
    searchPanelCloseShortcut,
    singleTabMode,
    desktopHotkeys,
  )

  return (
    <div className="space-y-6">
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

      {isElectronHost && (
        <DesktopGlobalHotkeysCard
          appShortcuts={appShortcuts}
          closeTabShortcut={closeTabShortcut}
          searchPanelCloseShortcut={searchPanelCloseShortcut}
          singleTabMode={singleTabMode}
        />
      )}

      <SettingsSectionCard title="全局动作">
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
            title="全局搜索"
            description="打开全局搜索面板快速跳转页面。"
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

      <SettingsSectionCard title={singleTabMode ? "面板关闭" : "关闭行为"}>
        {!singleTabMode && <ShortcutField
          id="close-tab-shortcut"
          title="关闭快捷键"
          description="默认留空。设置后，按一次依次关闭：通知 → 弹窗 → 搜索框 → 当前标签页。"
          value={closeTabShortcut}
          onChange={safeSetCloseTab}
          resetValue={DEFAULT_CLOSE_TAB_SHORTCUT}
        />}
        <div className={singleTabMode ? "" : "mt-2"}>
          <ShortcutField
            id="search-panel-close-shortcut"
            title="关闭搜索面板"
            description="在搜索面板打开时按下此键关闭搜索面板。"
            value={searchPanelCloseShortcut}
            onChange={safeSetSearchPanelClose}
            resetValue={DEFAULT_SEARCH_PANEL_CLOSE_SHORTCUT}
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="固定快捷键">
        <p className="mb-3 text-xs text-muted-foreground">
          应用主键：macOS 为 ⌘，Windows / Linux 为 Ctrl。Super（Linux）和 Win（Windows）是独立按键，不会和 Ctrl 混用。加粗、链接等编辑器格式键只在选中文字时生效，不占用可自定义快捷键。
        </p>
        <div className="space-y-0.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-4 py-1 text-[11px] text-muted-foreground">
            <span />
            {FIXED_SHORTCUT_PLATFORMS.map((item) => (
              <span key={item.id} className="justify-self-end">
                {item.label}
              </span>
            ))}
          </div>
          {FIXED_SHORTCUTS.filter((item) => !singleTabMode || !item.tabOnly).map((item) => (
            <FixedShortcutRow
              key={item.label}
              label={item.label}
              shortcut={item.shortcut}
            />
          ))}
        </div>
      </SettingsSectionCard>
    </div>
  )
}
