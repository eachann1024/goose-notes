import { renderShortcutSettingsColumns } from "./shortcut-settings/renderShortcutSettingsColumns";
import { Button } from "@/components/ui/button";
import { type SettingsShortcutsProps } from "./shortcut-settings/shared";
import { useShortcutSettings } from "./shortcut-settings/useShortcutSettings";

export function SettingsShortcuts(props: SettingsShortcutsProps) {
  const shortcutSettingsContext = useShortcutSettings(props);
  const context = shortcutSettingsContext;
  const { confirmReset, setConfirmReset, handleReset } = context;

  return (
    <div className="settings-shortcuts">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-semibold tracking-tight text-foreground">
          快捷键
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 rounded-[10px]"
          onClick={handleReset}
          onBlur={() => setConfirmReset(false)}
        >
          {confirmReset ? "再次点击确认恢复" : "恢复默认"}
        </Button>
      </div>

      {renderShortcutSettingsColumns(context)}
    </div>
  );
}
