import { UToolsAdapter } from "@/lib/utools";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import * as LucideIcons from "lucide-react";
import {
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
  customActions?: CustomAction[];
  addCustomAction?: (action: Omit<CustomAction, "id">) => void;
  updateCustomAction?: (id: string, updates: Partial<Omit<CustomAction, "id">>) => void;
  removeCustomAction?: (id: string) => void;
}

const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

const SETTINGS_SWITCH_CLASS =
  "data-[state=unchecked]:bg-[hsl(var(--foreground)/0.12)]";

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
  customActions = [],
  addCustomAction = () => {},
  updateCustomAction = () => {},
  removeCustomAction = () => {},
}: SettingsGeneralProps) {
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
