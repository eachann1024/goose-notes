interface SettingsGeneralProps {
  searchProviders: { id: string; name: string; isEnabled: boolean }[];
  toggleSearchProvider: (id: string) => void;
}

export function SettingsGeneral({
  searchProviders,
  toggleSearchProvider,
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
    </div>
  );
}
