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
  addCustomSearchProvider: (
    provider: Pick<SearchProvider, "name" | "urlTemplate">,
  ) => void;
  updateCustomSearchProvider: (
    id: string,
    provider: Pick<SearchProvider, "name" | "urlTemplate">,
  ) => void;
  removeCustomSearchProvider: (id: string) => void;
  autoOpenLastNote: boolean;
  setAutoOpenLastNote: (enabled: boolean) => void;
  showRecentInSearch: boolean;
  setShowRecentInSearch: (enabled: boolean) => void;
  notebookDropdownHoverExpand: boolean;
  setNotebookDropdownHoverExpand: (enabled: boolean) => void;
  customActions?: CustomAction[];
  addCustomAction?: (action: Omit<CustomAction, "id">) => void;
  updateCustomAction?: (
    id: string,
    updates: Partial<Omit<CustomAction, "id">>,
  ) => void;
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
  addCustomSearchProvider,
  updateCustomSearchProvider,
  removeCustomSearchProvider,
  autoOpenLastNote,
  setAutoOpenLastNote,
  showRecentInSearch,
  setShowRecentInSearch,
  notebookDropdownHoverExpand,
  setNotebookDropdownHoverExpand,
  customActions = [],
  addCustomAction = () => {},
  updateCustomAction = () => {},
  removeCustomAction = () => {},
}: SettingsGeneralProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        通用
      </h3>

      <SettingsSectionCard title="行为设置">
        <div
          className={`flex items-center justify-between gap-4 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}
        >
          <div>
            <div className="flex items-center gap-3">
              <LucideIcons.FileClock
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Label htmlFor="auto-open-last-note" className="cursor-pointer">
                自动打开上次笔记
              </Label>
            </div>
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              打开应用就直接跳到你上次编辑的那篇笔记，省去再点一次的麻烦。
            </p>
          </div>
          <Switch
            id="auto-open-last-note"
            checked={autoOpenLastNote}
            onCheckedChange={setAutoOpenLastNote}
            className={SETTINGS_SWITCH_CLASS}
          />
        </div>
        <div
          className={`flex items-center justify-between gap-4 p-4 mt-2 ${SETTINGS_OPTION_ROW_CLASS}`}
        >
          <div>
            <div className="flex items-center gap-3">
              <LucideIcons.MousePointer2
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Label htmlFor="notebook-hover-expand" className="cursor-pointer">
                悬停展开笔记本切换
              </Label>
            </div>
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              鼠标停在笔记本名称上就自动弹出切换菜单，不用点击。
            </p>
          </div>
          <Switch
            id="notebook-hover-expand"
            checked={notebookDropdownHoverExpand}
            onCheckedChange={setNotebookDropdownHoverExpand}
            className={SETTINGS_SWITCH_CLASS}
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="搜索设置">
        <div
          className={`flex items-center justify-between gap-4 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}
        >
          <div>
            <div className="flex items-center gap-3">
              <LucideIcons.History
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Label htmlFor="show-recent-in-search" className="cursor-pointer">
                搜索框显示最近访问
              </Label>
            </div>
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              关闭后搜索框里不再出现「最近访问」分组，只显示搜索结果。
            </p>
          </div>
          <Switch
            id="show-recent-in-search"
            checked={showRecentInSearch}
            onCheckedChange={setShowRecentInSearch}
            className={SETTINGS_SWITCH_CLASS}
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title={
          <span className="flex items-center gap-2">
            <LucideIcons.Search
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            搜索引擎
          </span>
        }
        description="配置右键菜单中显示的搜索引擎，支持拖拽排序。"
      >
        <SearchProviderSortableGrid
          providers={searchProviders}
          toggleSearchProvider={toggleSearchProvider}
          reorderSearchProviders={reorderSearchProviders}
          addCustomSearchProvider={addCustomSearchProvider}
          updateCustomSearchProvider={updateCustomSearchProvider}
          removeCustomSearchProvider={removeCustomSearchProvider}
        />
      </SettingsSectionCard>

      <SettingsSectionCard
          title={
            <span className="flex items-center gap-2">
              <LucideIcons.Zap
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              快捷动作
            </span>
          }
          description="右键菜单里直接跳转到其他插件，名称和指令都填完才能生效。"
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
            <p className="text-xs text-muted-foreground">
              暂无快捷动作，点击右上角添加。
            </p>
          )}
        </SettingsSectionCard>
    </div>
  );
}
