import { Button } from "@/components/ui/button";
import { getPlatformKind } from "@/lib/utils";
import { DEFAULT_APP_SHORTCUTS } from "@/stores/useSettings";
import { SettingsSectionCard } from "../SettingsSectionCard";
import { ShortcutField } from "../ShortcutField";
import {
  FIXED_CLOSE_SHORTCUT,
  FIXED_SPLIT_SHORTCUTS,
} from "@/lib/fixed-app-shortcuts";
import type { useShortcutSettings } from "./useShortcutSettings";
import {
  isElectronHost,
  FIXED_SHORTCUTS,
  FIXED_SHORTCUT_PLATFORMS,
  FixedShortcutRow,
  DesktopGlobalHotkeysCard,
} from "./shared";

export function renderShortcutSettingsColumns(
  context: ReturnType<typeof useShortcutSettings>,
) {
  const {
    closeTabShortcut,
    searchPanelCloseShortcut,
    appShortcuts,
    singleTabMode,
    selectedPlatform,
    setSelectedPlatform,
    safeSetAppShortcut,
  } = context;
  return (
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
            value={
              appShortcuts.toggleSidebar ?? DEFAULT_APP_SHORTCUTS.toggleSidebar
            }
            onChange={safeSetAppShortcut("toggleSidebar")}
            resetValue={DEFAULT_APP_SHORTCUTS.toggleSidebar}
          />
          <div className="mt-2">
            <ShortcutField
              id="shortcut-toggle-ai-panel"
              title="展开 / 收起 AI 助手"
              description="快速呼出或隐藏右侧 AI 助手面板。"
              value={
                appShortcuts.toggleAIPanel ??
                DEFAULT_APP_SHORTCUTS.toggleAIPanel
              }
              onChange={safeSetAppShortcut("toggleAIPanel")}
              resetValue={DEFAULT_APP_SHORTCUTS.toggleAIPanel}
            />
          </div>
          <div className="mt-2">
            <ShortcutField
              id="shortcut-open-search"
              title="应用内唤出搜索面板"
              description="仅在应用内生效。点击输入框修改，清空即停用，不影响全局快捷键。"
              value={
                appShortcuts.openSearch ?? DEFAULT_APP_SHORTCUTS.openSearch
              }
              onChange={safeSetAppShortcut("openSearch")}
              resetValue={DEFAULT_APP_SHORTCUTS.openSearch}
            />
          </div>
          <div className="mt-2">
            <ShortcutField
              id="shortcut-toggle-theme"
              title="切换深色模式"
              description="按 自动 → 浅色 → 深色 循环切换主题。"
              value={
                appShortcuts.toggleTheme ?? DEFAULT_APP_SHORTCUTS.toggleTheme
              }
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
              value={
                appShortcuts.navForward ?? DEFAULT_APP_SHORTCUTS.navForward
              }
              onChange={safeSetAppShortcut("navForward")}
              resetValue={DEFAULT_APP_SHORTCUTS.navForward}
            />
          </div>
          {!singleTabMode && (
            <>
              <div className="mt-2">
                <ShortcutField
                  id="shortcut-new-tab"
                  title="新建标签页"
                  description="开启新标签页并进入欢迎主页，支持快速检索与新建笔记。"
                  value={appShortcuts.newTab ?? DEFAULT_APP_SHORTCUTS.newTab}
                  onChange={safeSetAppShortcut("newTab")}
                  resetValue={DEFAULT_APP_SHORTCUTS.newTab}
                />
              </div>
            </>
          )}
        </SettingsSectionCard>

        <SettingsSectionCard title="分屏快捷键（固定）">
          <p className="mb-3 text-xs text-muted-foreground">
            分屏快捷键不可修改。向右分屏在编辑区较窄时会改为向下分屏。
          </p>
          <div className="space-y-1">
            {[
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
            ].map(([label, shortcut]) => (
              <FixedShortcutRow
                key={label}
                label={label}
                shortcut={shortcut}
                platform={getPlatformKind()}
              />
            ))}
          </div>
        </SettingsSectionCard>
      </div>
      <div className="space-y-5">
        <SettingsSectionCard title="关闭行为（固定）">
          <p className="mb-3 text-xs text-muted-foreground">
            按 Esc 依次关闭：通知 → 弹窗 → 当前分屏 → 当前标签页。
            正在编辑正文或搜索时优先退出当前焦点；桌面端快捷键遵循相同退出层级。
          </p>
          <div className="space-y-1">
            <FixedShortcutRow
              label="关闭当前内容"
              shortcut={FIXED_CLOSE_SHORTCUT}
              platform={getPlatformKind()}
            />
            <FixedShortcutRow
              label="关闭搜索面板"
              shortcut={FIXED_CLOSE_SHORTCUT}
              platform={getPlatformKind()}
            />
          </div>
        </SettingsSectionCard>

        <SettingsSectionCard title="固定快捷键">
          <p className="mb-3 text-xs text-muted-foreground">
            按当前平台查看固定快捷键；编辑器与侧栏快捷键仅在对应区域生效。
          </p>
          <div
            role="group"
            aria-label="查看平台快捷键"
            className="mb-3 flex flex-wrap gap-1"
          >
            {FIXED_SHORTCUT_PLATFORMS.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={selectedPlatform === item.id}
                onClick={() => setSelectedPlatform(item.id)}
                className={`h-8 rounded-lg px-3 text-xs ${selectedPlatform === item.id ? "bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]" : "text-muted-foreground"}`}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div
            className="settings-fixed-shortcuts space-y-1"
            role="region"
            aria-label={`${FIXED_SHORTCUT_PLATFORMS.find((item) => item.id === selectedPlatform)?.label} 固定快捷键`}
          >
            {FIXED_SHORTCUTS.filter(
              (item) =>
                (!singleTabMode || !item.tabOnly) &&
                (!item.desktopOnly || isElectronHost) &&
                (!item.platforms || item.platforms.includes(selectedPlatform)),
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
  );
}
