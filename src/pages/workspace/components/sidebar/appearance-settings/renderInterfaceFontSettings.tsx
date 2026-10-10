import { LocalFontInput } from "../../shared/LocalFontInput";
import type { useAppearanceSettings } from "./useAppearanceSettings";

export function renderInterfaceFontSettings(
  context: ReturnType<typeof useAppearanceSettings>,
) {
  const {
    uiFontFamily,
    sidebarFontFamily,
    setUIFontFamily,
    setSidebarFontFamily,
  } = context;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="appearance-ui-font">界面字体</Label>
          <LocalFontInput
            id="appearance-ui-font"
            value={uiFontFamily ?? ""}
            onChange={setUIFontFamily}
            placeholder="默认"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="appearance-sidebar-font">侧栏字体</Label>
          <LocalFontInput
            id="appearance-sidebar-font"
            value={sidebarFontFamily ?? ""}
            onChange={setSidebarFontFamily}
            placeholder="默认"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        作为所有笔记的基础排版字体；单篇笔记仍可在阅读菜单中单独切换无衬线、衬线或等宽。
      </p>
    </>
  );
}
