import { UToolsAdapter } from "@/lib/utools";
import { Slider } from "@/components/ui/slider";

interface SettingsGeneralProps {
  searchProviders: { id: string; name: string; isEnabled: boolean }[];
  toggleSearchProvider: (id: string) => void;
  openSearchInUtools: boolean;
  setOpenSearchInUtools: (enabled: boolean) => void;
  windowHeight: number;
  setWindowHeight: (height: number) => void;
}

export function SettingsGeneral({
  searchProviders,
  toggleSearchProvider,
  openSearchInUtools,
  setOpenSearchInUtools,
  windowHeight,
  setWindowHeight,
}: SettingsGeneralProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">通用</h3>
        <p className="text-sm text-muted-foreground">配置应用的通用设置。</p>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-3">搜索引擎</h4>
        <p className="text-xs text-muted-foreground mb-4">
          配置右键菜单中显示的搜索引擎。
        </p>
        <div className="space-y-3">
          {searchProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between"
            >
              <Label
                htmlFor={`provider-${provider.id}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                {provider.name}
              </Label>
              <Switch
                id={`provider-${provider.id}`}
                checked={provider.isEnabled}
                onCheckedChange={() => toggleSearchProvider(provider.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {(UToolsAdapter.isUTools || import.meta.env.DEV) && (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <h4 className="text-sm font-medium mb-3">插件设置</h4>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="open-in-utools" className="cursor-pointer">
                  使用 uTools 打开搜索
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  关闭后将使用系统默认浏览器打开
                </p>
              </div>
              <Switch
                id="open-in-utools"
                checked={openSearchInUtools}
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
              max={1000}
              step={10}
              onValueChange={([val]) => {
                setWindowHeight(val);
                UToolsAdapter.setExpendHeight(val);
              }}
              className="py-2"
            />
          </div>
        </div>
      )}
    </div>
  );
}
