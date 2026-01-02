import { SettingsAppearance } from "./SettingsAppearance";
import { SettingsGeneral } from "./SettingsGeneral";
import { SettingsSidebar } from "./SettingsSidebar";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = "general" | "appearance";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const {
    theme,
    setTheme,
    codeStyle,
    setCodeStyle,
    searchProviders,
    toggleSearchProvider,
    customFonts,
    setCustomLabel,
    setCustomFont,
    uiFontSize,
    setUIFontSize,
  } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[400px] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">设置</DialogTitle>
        <DialogDescription className="sr-only">
          配置应用的设置选项
        </DialogDescription>
        <div className="flex bg-muted/30 h-full">
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === "general" && (
              <SettingsGeneral
                searchProviders={searchProviders}
                toggleSearchProvider={toggleSearchProvider}
              />
            )}
            {activeTab === "appearance" && (
              <SettingsAppearance
                theme={theme}
                setTheme={setTheme}
                codeStyle={codeStyle}
                setCodeStyle={setCodeStyle}
                customFonts={customFonts}
                setCustomLabel={setCustomLabel}
                setCustomFont={setCustomFont}
                uiFontSize={uiFontSize}
                setUIFontSize={setUIFontSize}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
