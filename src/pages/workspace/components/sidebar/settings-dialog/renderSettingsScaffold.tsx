import { SettingsAppearance } from "../SettingsAppearance";
import { SettingsGeneral } from "../SettingsGeneral";
import { SettingsShortcuts } from "../settings/SettingsShortcuts";
import { SettingsLocalFolder } from "../SettingsLocalFolder";
import { SettingsGitSync } from "../settings/SettingsGitSync";
import { SettingsDataPanel } from "../settings/SettingsDataPanel";
import { SettingsAI } from "../SettingsAI";
import { SettingsScaffold } from "../settings/SettingsScaffold";
import { useSettings } from "@/stores/useSettings";
import { effectiveSingleTabMode } from "@/lib/tabMode";
import * as GooseIcons from "@/components/ui/icons";
import { ExternalLink } from "@/components/ui/icons";
import type { useSettingsResetActions } from "./useSettingsResetActions";
import { SETTINGS_TABS, GOOSE_APPS, isElectronHost } from "./shared";

export function renderSettingsScaffold(
  context: ReturnType<typeof useSettingsResetActions>,
) {
  const {
    open,
    onOpenChange,
    activeTab,
    onTabChange,
    sidebarContainer,
    mainContainer,
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    ai,
    setAIEnabled,
    setAIReadGlobalPrompt,
    setAIReadLocalSkills,
    setAISelectedModelId,
    saveAICustomConfig,
    privacy,
    setAutoOpenLastNote,
    singleTabMode,
    showRecentInSearch,
    setShowRecentInSearch,
    closeTabShortcut,
    setCloseTabShortcut,
    searchPanelCloseShortcut,
    setSearchPanelCloseShortcut,
    appShortcuts,
    setAppShortcut,
    resetAppShortcuts,
    customFonts,
    setCustomFont,
    uiFontSize,
    setUIFontSize,
    editorFontSize,
    increaseEditorFontSize,
    decreaseEditorFontSize,
    notebookDropdownHoverExpand,
    setNotebookDropdownHoverExpand,
    localFolderFileManager,
    setLocalFolderFileManager,
    localFolderExternalEditor,
    setLocalFolderExternalEditor,
    localFolderTerminal,
    setLocalFolderTerminal,
    localFolderHiddenFolders,
    setLocalFolderHiddenFolders,
    selectedIds,
    format,
    setFormat,
    exporting,
    importing,
    setResetDialogOpen,
    appsBannerVisible,
    notebookList,
    toggleNotebook,
    selectAll,
    handleExport,
    handleImport,
    handleReset,
    handleCloseAppsBanner,
    handleOpenApp,
  } = context;
  return (
    <SettingsScaffold
      activeTab={activeTab}
      onTabChange={onTabChange}
      onClose={() => onOpenChange(false)}
      tabs={SETTINGS_TABS}
      sidebarContainer={sidebarContainer}
      mainContainer={mainContainer}
      visible={open}
      feedbackBanner={null}
      appsBanner={
        appsBannerVisible && !isElectronHost ? (
          <div className="relative rounded-[10px] bg-[hsl(var(--goose-selected-bg)/0.62)] p-3">
            <button
              type="button"
              onClick={handleCloseAppsBanner}
              className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
              aria-label="关闭 Goose 鹅系列工具"
            >
              <GooseIcons.X className="h-3 w-3" />
            </button>
            <p className="mb-2 pr-4 text-xs font-medium text-muted-foreground">
              Goose 鹅系列工具
            </p>
            <div className="space-y-1">
              {GOOSE_APPS.map((app) => (
                <Button
                  key={app.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenApp(app)}
                  className="h-auto w-full justify-start gap-2 rounded-[10px] px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)]"
                >
                  <img
                    src={app.icon}
                    alt=""
                    className="h-4 w-4 shrink-0 rounded-[4px] object-cover"
                  />
                  <span className="flex-1 truncate">{app.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </Button>
              ))}
            </div>
          </div>
        ) : null
      }
    >
      {activeTab === "general" && (
        <div className="settings-groups">
          <SettingsGeneral
            autoOpenLastNote={privacy.autoOpenLastNote}
            setAutoOpenLastNote={setAutoOpenLastNote}
            showRecentInSearch={showRecentInSearch}
            setShowRecentInSearch={setShowRecentInSearch}
            notebookDropdownHoverExpand={notebookDropdownHoverExpand}
            setNotebookDropdownHoverExpand={setNotebookDropdownHoverExpand}
          />
        </div>
      )}

      {activeTab === "shortcuts" && (
        <div className="settings-groups">
          <SettingsShortcuts
            closeTabShortcut={closeTabShortcut}
            setCloseTabShortcut={setCloseTabShortcut}
            searchPanelCloseShortcut={searchPanelCloseShortcut}
            setSearchPanelCloseShortcut={setSearchPanelCloseShortcut}
            appShortcuts={appShortcuts}
            setAppShortcut={setAppShortcut}
            resetAppShortcuts={resetAppShortcuts}
            singleTabMode={effectiveSingleTabMode(singleTabMode)}
          />
        </div>
      )}

      {activeTab === "local-folder" && (
        <div className="settings-groups">
          <SettingsLocalFolder
            visible={open}
            localFolderFileManager={localFolderFileManager}
            setLocalFolderFileManager={setLocalFolderFileManager}
            localFolderExternalEditor={localFolderExternalEditor}
            setLocalFolderExternalEditor={setLocalFolderExternalEditor}
            localFolderTerminal={localFolderTerminal}
            setLocalFolderTerminal={setLocalFolderTerminal}
            localFolderHiddenFolders={localFolderHiddenFolders}
            setLocalFolderHiddenFolders={setLocalFolderHiddenFolders}
          />
        </div>
      )}

      {activeTab === "appearance" && (
        <SettingsAppearance
          theme={theme}
          setTheme={setTheme}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
          customFonts={customFonts}
          setCustomFont={setCustomFont}
          uiFontSize={uiFontSize}
          setUIFontSize={setUIFontSize}
          editorFontSize={editorFontSize}
          increaseEditorFontSize={increaseEditorFontSize}
          decreaseEditorFontSize={decreaseEditorFontSize}
        />
      )}

      {activeTab === "ai" && (
        <div className="settings-groups">
          <SettingsAI
            visible={open}
            ai={ai}
            enabled={ai.enabled}
            setEnabled={setAIEnabled}
            setReadGlobalPrompt={setAIReadGlobalPrompt}
            setReadLocalSkills={setAIReadLocalSkills}
            selectedModelId={ai.selectedModelId}
            setSelectedModelId={setAISelectedModelId}
            saveCustomConfig={saveAICustomConfig}
          />
        </div>
      )}

      {activeTab === "git-sync" && <SettingsGitSync visible={open} />}

      {activeTab === "data" && (
        <div className="settings-groups">
          <SettingsDataPanel
            active={open}
            importing={importing}
            onImport={handleImport}
            selectedIds={selectedIds}
            notebookList={notebookList}
            onToggleNotebook={toggleNotebook}
            onSelectAll={selectAll}
            format={format}
            onFormatChange={setFormat}
            exporting={exporting}
            onExport={handleExport}
            onOpenResetDialog={() => setResetDialogOpen(true)}
            onRestartGuide={() => {
              onOpenChange(false);
              useSettings.setState({ setupGuideOpen: true });
            }}
            onResetAndImport={handleReset}
          />
        </div>
      )}
    </SettingsScaffold>
  );
}
