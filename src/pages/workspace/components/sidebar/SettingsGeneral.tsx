import { UToolsAdapter } from "@/lib/utools";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import * as LucideIcons from "lucide-react";
import type { CustomAction } from "@/stores/useSettings";

interface SettingsGeneralProps {
  searchProviders: { id: string; name: string; isEnabled: boolean }[];
  toggleSearchProvider: (id: string) => void;
  openSearchInUtools: boolean;
  setOpenSearchInUtools: (enabled: boolean) => void;

  windowHeight: number;
  setWindowHeight: (height: number) => void;
  autoOpenLastNote: boolean;
  setAutoOpenLastNote: (enabled: boolean) => void;
  customActions?: CustomAction[];
  addCustomAction?: (action: Omit<CustomAction, 'id'>) => void;
  updateCustomAction?: (id: string, updates: Partial<Omit<CustomAction, 'id'>>) => void;
  removeCustomAction?: (id: string) => void;
}

export function SettingsGeneral({
  searchProviders,
  toggleSearchProvider,
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
        <h3 className="text-lg font-medium">通用</h3>
        <p className="text-sm text-muted-foreground">配置应用的通用设置。</p>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-3">隐私设置</h4>
        <div className="rounded-xl border bg-muted/20 p-4 flex items-center justify-between gap-4">
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
          />
        </div>
      </div>

      <div className="pt-4 border-t">
        <h4 className="text-sm font-medium mb-3">搜索引擎</h4>
        <p className="text-xs text-muted-foreground mb-4">
          配置右键菜单中显示的搜索引擎。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {searchProviders.map((provider) => (
            <div
              key={provider.id}
              className="rounded-lg border bg-background px-3 py-2.5 flex items-center justify-between gap-2"
            >
              <Label
                htmlFor={`provider-${provider.id}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                {provider.name}
              </Label>
              <Switch
                id={`provider-${provider.id}`}
                checked={provider.isEnabled ?? false}
                onCheckedChange={() => toggleSearchProvider(provider.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {UToolsAdapter.isUTools && (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <h4 className="text-sm font-medium mb-3">插件设置</h4>
            
            {/* 自动搜索开关已移除 */}


            <div className="rounded-xl border bg-muted/20 p-4 flex items-center justify-between gap-4">
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
              />
            </div>
          </div>

          <div className="pt-4 border-t">
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
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-medium">快捷动作</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  右键菜单中跳转到其他插件，必填项必须要填写完整，否则无法启用
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  addCustomAction({
                    name: "",
                    command: "",
                    isEnabled: true,
                  });
                }}
              >
                <LucideIcons.Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>

            {customActions.length > 0 && (
              <div className="space-y-2">
                {customActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center gap-2 py-2 px-2 rounded border bg-muted/30"
                  >
                    <Input
                      placeholder="名称"
                      value={action.name}
                      onChange={(e) =>
                        updateCustomAction(action.id, { name: e.target.value })
                      }
                      onBlur={(e) =>
                        updateCustomAction(action.id, { name: e.target.value.trim() })
                      }
                      className="text-sm h-8"
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
                        updateCustomAction(action.id, { command: e.target.value.trim() })
                      }
                      className="text-sm h-8"
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
                      className="text-sm h-8"
                    />
                    <Switch
                      checked={action.isEnabled}
                      onCheckedChange={(checked) =>
                        updateCustomAction(action.id, { isEnabled: checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeCustomAction(action.id)}
                    >
                      <LucideIcons.Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
