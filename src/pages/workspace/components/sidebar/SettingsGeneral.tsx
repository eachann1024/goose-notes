import { UToolsAdapter } from "@/lib/utools";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import * as LucideIcons from "lucide-react";
import {
  DEFAULT_CLOSE_TAB_SHORTCUT,
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
  showRecentInSearch: boolean;
  setShowRecentInSearch: (enabled: boolean) => void;
  closeTabShortcut: string;
  setCloseTabShortcut: (shortcut: string) => void;
  searchPanelCloseShortcut: string;
  setSearchPanelCloseShortcut: (shortcut: string) => void;
  customActions?: CustomAction[];
  addCustomAction?: (action: Omit<CustomAction, "id">) => void;
  updateCustomAction?: (id: string, updates: Partial<Omit<CustomAction, "id">>) => void;
  removeCustomAction?: (id: string) => void;
}

const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

const SETTINGS_SWITCH_CLASS =
  "data-[state=unchecked]:bg-[hsl(var(--foreground)/0.12)]";

interface ShortcutInputEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
}

interface ShortcutFieldProps {
  id: string;
  title: string;
  description: string;
  value: string;
  onChange: (shortcut: string) => void;
  resetValue?: string;
}

const MODIFIER_KEYS = new Set(["control", "ctrl", "meta", "alt", "shift"]);
const MODIFIER_ORDER = ["Ctrl", "Meta", "Alt", "Shift"];

function normalizeShortcutKey(rawKey: string) {
  const key = rawKey.trim().toLowerCase();
  if (!key) return "";
  if (key === "control" || key === "ctrl") return "Ctrl";
  if (key === "meta" || key === "command" || key === "cmd") return "Meta";
  if (key === "alt" || key === "option") return "Alt";
  if (key === "shift") return "Shift";
  if (key === "escape" || key === "esc") return "Esc";
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function getShortcutFromKeyEvent(event: ShortcutInputEvent) {
  const baseModifiers = [
    event.ctrlKey ? "Ctrl" : "",
    event.metaKey ? "Meta" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
  ].filter(Boolean);
  const normalizedKey = normalizeShortcutKey(event.key);
  const isModifierKey = MODIFIER_KEYS.has(event.key.toLowerCase());
  const hasKey = normalizedKey && !isModifierKey;
  const tokens = hasKey ? [...baseModifiers, normalizedKey] : baseModifiers;
  const ordered = MODIFIER_ORDER.filter((key) => tokens.includes(key));
  if (hasKey) {
    ordered.push(normalizedKey);
  }
  return ordered.join("+");
}

function ShortcutField({
  id,
  title,
  description,
  value,
  onChange,
  resetValue,
}: ShortcutFieldProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const displayValue = value ? formatShortcut(value) : "";
  const hintText = isCapturing
    ? "正在监听，现可直接按下快捷键"
    : "点击输入框后开始录入快捷键";

  return (
    <div className={`space-y-2 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}>
      <div>
        <Label htmlFor={id} className="cursor-pointer">
          {title}
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={displayValue}
          readOnly
          placeholder={isCapturing ? "现在可以按下快捷键..." : "点击后按下快捷键"}
          className={cn(
            "h-9 text-sm transition-colors",
            isCapturing && "placeholder:text-red-500",
          )}
          onFocus={() => setIsCapturing(true)}
          onBlur={() => setIsCapturing(false)}
          onKeyDown={(event) => {
            if (
              event.key === "Tab" &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey &&
              !event.shiftKey
            ) {
              return;
            }

            if (
              (event.key === "Backspace" || event.key === "Delete") &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey &&
              !event.shiftKey
            ) {
              event.preventDefault();
              event.stopPropagation();
              onChange("");
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            onChange(getShortcutFromKeyEvent(event));
          }}
        />
        {resetValue !== undefined && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-[10px]"
            onClick={() => onChange(resetValue)}
          >
            恢复默认
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 rounded-[10px]"
          onClick={() => onChange("")}
        >
          清空
        </Button>
      </div>
      <p
        className={cn(
          "text-[11px] transition-colors",
          isCapturing
            ? "shortcut-capture-hint font-medium"
            : "text-muted-foreground",
        )}
      >
        {hintText}
      </p>
    </div>
  );
}

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
  showRecentInSearch,
  setShowRecentInSearch,
  closeTabShortcut,
  setCloseTabShortcut,
  searchPanelCloseShortcut,
  setSearchPanelCloseShortcut,
  customActions = [],
  addCustomAction = () => {},
  updateCustomAction = () => {},
  removeCustomAction = () => {},
}: SettingsGeneralProps) {
  const isMac = isMacPlatform();
  const closeTabDefaultLabel = formatShortcut(DEFAULT_CLOSE_TAB_SHORTCUT);
  const closeTabShortcutDescription = `默认 ${closeTabDefaultLabel}，可自定义修改。`;
  const modifierExample = isMac ? "⌘" : "Ctrl";
  const searchPanelCloseDescription = `支持单修饰键（如 ${modifierExample}）和组合键，默认不设置。`;

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

      <SettingsSectionCard title="搜索设置">
        <div className={`flex items-center justify-between gap-4 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}>
          <div>
            <Label htmlFor="show-recent-in-search" className="cursor-pointer">
              搜索框显示最近访问
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              关闭后不显示“最近访问”分组
            </p>
          </div>
          <Switch
            id="show-recent-in-search"
            checked={showRecentInSearch}
            onCheckedChange={setShowRecentInSearch}
            className={SETTINGS_SWITCH_CLASS}
          />
        </div>
        <ShortcutField
          id="search-panel-close-shortcut"
          title="退出搜索框快捷键"
          description={searchPanelCloseDescription}
          value={searchPanelCloseShortcut}
          onChange={setSearchPanelCloseShortcut}
        />
      </SettingsSectionCard>

      <SettingsSectionCard title="标签页设置">
        <ShortcutField
          id="close-tab-shortcut"
          title="关闭标签页快捷键"
          description={closeTabShortcutDescription}
          value={closeTabShortcut}
          onChange={setCloseTabShortcut}
          resetValue={DEFAULT_CLOSE_TAB_SHORTCUT}
        />
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
    </div>
  );
}
