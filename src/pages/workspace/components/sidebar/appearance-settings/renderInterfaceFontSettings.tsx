import { Label } from "@/components/ui/label";
import { LocalFontSelect } from "../../shared/LocalFontSelect";
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
      <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <Label htmlFor="appearance-ui-font">界面字体</Label>
          <LocalFontSelect
            id="appearance-ui-font"
            label="界面字体"
            value={uiFontFamily}
            onChange={setUIFontFamily}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Label htmlFor="appearance-sidebar-font">侧栏字体</Label>
          <LocalFontSelect
            id="appearance-sidebar-font"
            label="侧栏字体"
            value={sidebarFontFamily}
            onChange={setSidebarFontFamily}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        作为所有笔记的基础排版字体；单篇笔记仍可在阅读菜单中单独切换无衬线、衬线或等宽。
      </p>
    </>
  );
}
