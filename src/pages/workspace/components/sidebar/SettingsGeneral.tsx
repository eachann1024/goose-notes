import { UToolsAdapter } from "@/lib/utools";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import * as LucideIcons from "lucide-react";
import {
  DEFAULT_SEARCH_HOTKEY,
  DEFAULT_WAKE_HOTKEY,
  type CustomAction,
  type SearchProvider,
} from "@/stores/useSettings";
import { SearchProviderSortableGrid } from "./SearchProviderSortableGrid";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";

interface SettingsGeneralProps {
  searchProviders: SearchProvider[];
  toggleSearchProvider: (id: string) => void;
  reorderSearchProviders: (nextIds: string[]) => void;
  openSearchInUtools: boolean;
  setOpenSearchInUtools: (enabled: boolean) => void;

  windowHeight: number;
  setWindowHeight: (height: number) => void;
  autoOpenLastNote: boolean;
  setAutoOpenLastNote: (enabled: boolean) => void;
  wakeHotkey: string;
  wakeHotkeyEnabled: boolean;
  searchHotkey: string;
  searchHotkeyEnabled: boolean;
  setWakeHotkey: (hotkey: string) => void;
  setWakeHotkeyEnabled: (enabled: boolean) => void;
  setSearchHotkey: (hotkey: string) => void;
  setSearchHotkeyEnabled: (enabled: boolean) => void;
  customActions?: CustomAction[];
  addCustomAction?: (action: Omit<CustomAction, 'id'>) => void;
  updateCustomAction?: (id: string, updates: Partial<Omit<CustomAction, 'id'>>) => void;
  removeCustomAction?: (id: string) => void;
}

const MODIFIER_KEYS = new Set(["Meta", "Control", "Alt", "Shift"]);

const SPECIAL_KEY_LABEL_MAP: Record<string, string> = {
  " ": "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Escape: "Esc",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
};

const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

const SETTINGS_HOTKEY_DISPLAY_CLASS =
  "inline-flex h-9 min-w-[200px] items-center rounded-lg bg-[hsl(var(--goose-selected-bg)/0.72)] px-3 font-mono text-sm text-foreground dark:bg-[hsl(var(--foreground)/0.1)]";

const SETTINGS_SWITCH_CLASS =
  "data-[state=unchecked]:bg-[hsl(var(--foreground)/0.12)]";

const SETTINGS_DISABLED_HOTKEY_DISPLAY_CLASS =
  "opacity-50 text-muted-foreground";

const SETTINGS_DISABLED_BUTTON_CLASS =
  "disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none";

const toHotkeyString = (event: KeyboardEvent): string | null => {
  const modifiers: string[] = [];

  if (event.metaKey || event.ctrlKey) {
    modifiers.push("CmdOrCtrl");
  }
  if (event.altKey) {
    modifiers.push("Alt");
  }
  if (event.shiftKey) {
    modifiers.push("Shift");
  }

  if (modifiers.length === 0) {
    return null;
  }

  const key = event.key;
  if (!key || MODIFIER_KEYS.has(key)) {
    return null;
  }

  const mappedKey = SPECIAL_KEY_LABEL_MAP[key];
  if (mappedKey) {
    return [...modifiers, mappedKey].join("+");
  }

  if (/^F\d{1,2}$/i.test(key)) {
    return [...modifiers, key.toUpperCase()].join("+");
  }

  if (key.length === 1) {
    return [...modifiers, key.toUpperCase()].join("+");
  }

  return [...modifiers, key.slice(0, 1).toUpperCase() + key.slice(1)].join("+");
};

export function SettingsGeneral({
  searchProviders,
  toggleSearchProvider,
  reorderSearchProviders,
  openSearchInUtools,
  setOpenSearchInUtools,

  windowHeight,
  setWindowHeight,
  autoOpenLastNote,
  setAutoOpenLastNote,
  wakeHotkey,
  wakeHotkeyEnabled,
  searchHotkey,
  searchHotkeyEnabled,
  setWakeHotkey,
  setWakeHotkeyEnabled,
  setSearchHotkey,
  setSearchHotkeyEnabled,
  customActions = [],
  addCustomAction = () => {},
  updateCustomAction = () => {},
  removeCustomAction = () => {},
}: SettingsGeneralProps) {
  const [isCapturingWakeHotkey, setIsCapturingWakeHotkey] = useState(false);
  const [hotkeyCaptureError, setHotkeyCaptureError] = useState<string | null>(
    null,
  );
  const [isCapturingSearchHotkey, setIsCapturingSearchHotkey] = useState(false);
  const [searchHotkeyCaptureError, setSearchHotkeyCaptureError] = useState<string | null>(
    null,
  );
  const isWakeHotkeyActionDisabled = !wakeHotkeyEnabled;

  useEffect(() => {
    if (!isCapturingWakeHotkey || !wakeHotkeyEnabled) return;

    const handleKeydown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setIsCapturingWakeHotkey(false);
        setHotkeyCaptureError(null);
        return;
      }

      const nextHotkey = toHotkeyString(event);
      if (!nextHotkey) {
        setHotkeyCaptureError("请至少包含一个修饰键（Cmd/Ctrl、Alt、Shift）");
        return;
      }

      setWakeHotkey(nextHotkey);
      setHotkeyCaptureError(null);
      setIsCapturingWakeHotkey(false);
    };

    window.addEventListener("keydown", handleKeydown, true);
    return () => {
      window.removeEventListener("keydown", handleKeydown, true);
    };
  }, [isCapturingWakeHotkey, setWakeHotkey, wakeHotkeyEnabled]);

  const handleWakeHotkeyEnabledChange = (enabled: boolean) => {
    setWakeHotkeyEnabled(enabled);
    if (enabled) return;
    setIsCapturingWakeHotkey(false);
    setHotkeyCaptureError(null);
  };

  useEffect(() => {
    if (!isCapturingSearchHotkey || !searchHotkeyEnabled) return;

    const handleKeydown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setIsCapturingSearchHotkey(false);
        setSearchHotkeyCaptureError(null);
        return;
      }

      const nextHotkey = toHotkeyString(event);
      if (!nextHotkey) {
        setSearchHotkeyCaptureError("请至少包含一个修饰键（Cmd/Ctrl、Alt、Shift）");
        return;
      }

      setSearchHotkey(nextHotkey);
      setSearchHotkeyCaptureError(null);
      setIsCapturingSearchHotkey(false);
    };

    window.addEventListener("keydown", handleKeydown, true);
    return () => {
      window.removeEventListener("keydown", handleKeydown, true);
    };
  }, [isCapturingSearchHotkey, searchHotkeyEnabled, setSearchHotkey]);

  const handleSearchHotkeyEnabledChange = (enabled: boolean) => {
    setSearchHotkeyEnabled(enabled);
    if (enabled) return;
    setIsCapturingSearchHotkey(false);
    setSearchHotkeyCaptureError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight text-foreground">通用</h3>
        <p className="mt-1 text-sm text-muted-foreground">配置应用的通用设置。</p>
      </div>

      <SettingsSectionCard title="隐私设置">
        <div className={`flex items-center justify-between gap-4 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}>
          <div>
            <Label htmlFor="auto-open-last-note" className="cursor-pointer">
              自动打开上次笔记
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              启动应用时自动打开上次编辑的笔记
            </p>
          </div>
          <Switch
            id="auto-open-last-note"
            checked={autoOpenLastNote}
            onCheckedChange={setAutoOpenLastNote}
            className={SETTINGS_SWITCH_CLASS}
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title="搜索引擎"
        description="配置右键菜单中显示的搜索引擎，支持拖拽排序。"
      >
        <SearchProviderSortableGrid
          providers={searchProviders}
          toggleSearchProvider={toggleSearchProvider}
          reorderSearchProviders={reorderSearchProviders}
        />
      </SettingsSectionCard>

      {UToolsAdapter.isUTools && (
        <>
          <SettingsSectionCard title="插件设置">
            <div className={`flex items-center justify-between gap-4 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}>
              <div>
                <Label htmlFor="open-in-utools" className="cursor-pointer">
                  使用 uTools 打开搜索结果
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  关闭后将使用系统默认浏览器打开
                </p>
              </div>
              <Switch
                id="open-in-utools"
                checked={openSearchInUtools ?? false}
                onCheckedChange={setOpenSearchInUtools}
                className={SETTINGS_SWITCH_CLASS}
              />
            </div>
          </SettingsSectionCard>

          <SettingsSectionCard title="窗口高度">
            <div className="flex items-center justify-between mb-2">
              <Label>窗口高度</Label>
              <span className="text-sm text-muted-foreground">
                {windowHeight}px
              </span>
            </div>
            <Slider
              value={[windowHeight]}
              min={300}
              max={900}
              step={10}
              onValueChange={([val]) => {
                setWindowHeight(val);
                UToolsAdapter.setExpendHeight(val);
              }}
              className="py-2"
            />
          </SettingsSectionCard>

          <SettingsSectionCard
            title="快捷动作"
            description="右键菜单中跳转到其他插件，必填项必须填写完整。"
            actions={
              <Button
                size="sm"
                variant="secondary"
                className="rounded-[10px]"
                onClick={() => {
                  addCustomAction({
                    name: "",
                    command: "",
                    isEnabled: true,
                  });
                }}
              >
                <LucideIcons.Plus className="mr-1 h-4 w-4" />
                添加
              </Button>
            }
          >
            {customActions.length > 0 ? (
              <div className="space-y-2">
                {customActions.map((action) => (
                  <div
                    key={action.id}
                    className={`flex items-center gap-2 px-2 py-2 ${SETTINGS_OPTION_ROW_CLASS}`}
                  >
                    <Input
                      placeholder="名称"
                      value={action.name}
                      onChange={(e) =>
                        updateCustomAction(action.id, { name: e.target.value })
                      }
                      onBlur={(e) =>
                        updateCustomAction(action.id, {
                          name: e.target.value.trim(),
                        })
                      }
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="指令"
                      value={action.command}
                      onChange={(e) =>
                        updateCustomAction(action.id, {
                          command: e.target.value,
                        })
                      }
                      onBlur={(e) =>
                        updateCustomAction(action.id, {
                          command: e.target.value.trim(),
                        })
                      }
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="插件名（可选）"
                      value={action.pluginName || ""}
                      onChange={(e) =>
                        updateCustomAction(action.id, {
                          pluginName: e.target.value || undefined,
                        })
                      }
                      onBlur={(e) =>
                        updateCustomAction(action.id, {
                          pluginName: e.target.value.trim() || undefined,
                        })
                      }
                      className="h-8 text-sm"
                    />
                    <Switch
                      checked={action.isEnabled}
                      onCheckedChange={(checked) =>
                        updateCustomAction(action.id, { isEnabled: checked })
                      }
                      className={SETTINGS_SWITCH_CLASS}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-[10px]"
                      onClick={() => removeCustomAction(action.id)}
                    >
                      <LucideIcons.Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无快捷动作，点击右上角添加。</p>
            )}
          </SettingsSectionCard>
        </>
      )}

      {UToolsAdapter.isTauri && (
        <>
          <SettingsSectionCard title="桌面唤醒">
            <div className={`flex items-center justify-between gap-4 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}>
              <div>
                <Label htmlFor="wake-hotkey-enabled" className="cursor-pointer">
                  启用全局唤醒快捷键
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  仅支持唤醒已运行的应用，不能冷启动
                </p>
              </div>
              <Switch
                id="wake-hotkey-enabled"
                checked={wakeHotkeyEnabled}
                onCheckedChange={handleWakeHotkeyEnabledChange}
                className={SETTINGS_SWITCH_CLASS}
              />
            </div>
          </SettingsSectionCard>

          <SettingsSectionCard
            title="全局唤醒快捷键"
            description="点击“录制快捷键”后直接按键触发，不需要手动输入。"
          >
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={`${SETTINGS_HOTKEY_DISPLAY_CLASS} ${isWakeHotkeyActionDisabled ? SETTINGS_DISABLED_HOTKEY_DISPLAY_CLASS : ""}`}
              >
                {wakeHotkey || DEFAULT_WAKE_HOTKEY}
              </div>
              <Button
                type="button"
                variant={isCapturingWakeHotkey ? "default" : "secondary"}
                size="sm"
                className={SETTINGS_DISABLED_BUTTON_CLASS}
                disabled={isWakeHotkeyActionDisabled}
                onClick={() => {
                  setSearchHotkeyCaptureError(null);
                  setIsCapturingSearchHotkey(false);
                  setHotkeyCaptureError(null);
                  setIsCapturingWakeHotkey(true);
                }}
              >
                {isCapturingWakeHotkey ? "请按下快捷键..." : "录制快捷键"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={SETTINGS_DISABLED_BUTTON_CLASS}
                disabled={isWakeHotkeyActionDisabled}
                onClick={() => {
                  setWakeHotkey(DEFAULT_WAKE_HOTKEY);
                  setHotkeyCaptureError(null);
                  setIsCapturingWakeHotkey(false);
                }}
              >
                恢复默认
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isCapturingWakeHotkey
                ? "正在录制：请按下组合键，按 Esc 取消。"
                : "默认启用组合键，建议避免与系统级快捷键冲突。"}
            </p>
            {hotkeyCaptureError && (
              <p className="text-xs text-destructive">{hotkeyCaptureError}</p>
            )}
          </SettingsSectionCard>

          <SettingsSectionCard title="全局搜索快捷键">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="search-hotkey-enabled" className="cursor-pointer">
                  启用全局搜索快捷键
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  仅对运行中的应用生效，退出后不生效
                </p>
              </div>
              <Switch
                id="search-hotkey-enabled"
                checked={searchHotkeyEnabled}
                onCheckedChange={handleSearchHotkeyEnabledChange}
                className={SETTINGS_SWITCH_CLASS}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <div className={SETTINGS_HOTKEY_DISPLAY_CLASS}>
                {searchHotkey || DEFAULT_SEARCH_HOTKEY}
              </div>
              <Button
                type="button"
                variant={isCapturingSearchHotkey ? "default" : "secondary"}
                size="sm"
                disabled={!searchHotkeyEnabled}
                onClick={() => {
                  setHotkeyCaptureError(null);
                  setIsCapturingWakeHotkey(false);
                  setSearchHotkeyCaptureError(null);
                  setIsCapturingSearchHotkey(true);
                }}
              >
                {isCapturingSearchHotkey ? "请按下快捷键..." : "录制搜索快捷键"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!searchHotkeyEnabled}
                onClick={() => {
                  setSearchHotkey(DEFAULT_SEARCH_HOTKEY);
                  setSearchHotkeyCaptureError(null);
                  setIsCapturingSearchHotkey(false);
                }}
              >
                恢复默认
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isCapturingSearchHotkey
                ? "正在录制：请按下组合键，按 Esc 取消。"
                : "默认：CmdOrCtrl+Shift+K。按下后会唤醒窗口并打开搜索。"}
            </p>
            {searchHotkeyCaptureError && (
              <p className="text-xs text-destructive">{searchHotkeyCaptureError}</p>
            )}
          </SettingsSectionCard>
        </>
      )}
    </div>
  );
}
