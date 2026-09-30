import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LOCAL_FOLDER_EDITOR_CANDIDATES,
  LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
  LOCAL_FOLDER_TERMINAL_CANDIDATES,
  type LocalFolderOpenAppCandidate,
} from "@/lib/local-folder-open-apps";
import { getCachedAvailableOpenApps, shell } from "@/lib/electron-platform/shell";
import { fs } from "@/lib/electron-platform/fs";
import * as LucideIcons from "lucide-react";
import { SettingsSectionCard } from "./settings/SettingsSectionCard";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { HostAdapter } from "@/lib/host/adapter";
import { PAGE_DOC_PREFIX } from "@/lib/storage/pageRepository";
import { getPageTitle } from "@/components/editor/utils/page-title";
import type { Page } from "@/types";

const isElectronHost = __HOST_TARGET__ === "electron";

/** 检测 db 中残留的内置（非本地文件）页面——桌面模式下用于一次性导出。 */
function listLegacyInternalPages(): Page[] {
  try {
    return HostAdapter.db
      .allDocs<Page>(PAGE_DOC_PREFIX)
      .map((doc) => doc.data)
      .filter((page) => page && !page.localFilePath && !page.trashedAt);
  } catch {
    return [];
  }
}

interface SettingsLocalFolderProps {
  localFolderFileManager: string;
  setLocalFolderFileManager: (value: string) => void;
  localFolderExternalEditor: string;
  setLocalFolderExternalEditor: (value: string) => void;
  localFolderTerminal: string;
  setLocalFolderTerminal: (value: string) => void;
  localFolderHiddenFolders: string[];
  setLocalFolderHiddenFolders: (folders: string[]) => void;
}

interface OpenAppFieldProps {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string;
  onChange: (value: string) => void;
  defaultLabel: string;
  customPlaceholder: string;
  options: LocalFolderOpenAppCandidate[];
  systemIds?: ReadonlySet<string>;
}

const SYSTEM_VALUE = "__system__";
const CUSTOM_VALUE = "__custom__";
const DEFAULT_HIDDEN_FOLDERS = ["assets"];

const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

const SYSTEM_FILE_MANAGER_IDS = new Set(["finder", "explorer", "nautilus"]);
const SYSTEM_TERMINAL_IDS = new Set(["terminal", "cmd", "x-terminal-emulator"]);

function getSystemDefaultLabels() {
  const platform = navigator.platform || navigator.userAgent;
  if (/Win/i.test(platform)) {
    return {
      fileManager: "系统默认（资源管理器）",
      terminal: "系统默认（命令提示符）",
    };
  }
  if (/Mac/i.test(platform)) {
    return {
      fileManager: "系统默认（访达）",
      terminal: "系统默认（终端）",
    };
  }
  return {
    fileManager: "系统默认（文件管理器）",
    terminal: "系统默认（终端）",
  };
}

function OpenAppField({
  id,
  title,
  description,
  icon: Icon,
  value,
  onChange,
  defaultLabel,
  customPlaceholder,
  options,
  systemIds,
}: OpenAppFieldProps) {
  const trimmedValue = value.trim();
  const matchedOption = useMemo(
    () => options.find((option) => option.appName === trimmedValue),
    [options, trimmedValue],
  );
  const isCustomValue = Boolean(trimmedValue && !matchedOption);
  const [customActive, setCustomActive] = useState(isCustomValue);

  useEffect(() => {
    if (isCustomValue) {
      setCustomActive(true);
      return;
    }
    if (trimmedValue && matchedOption) {
      setCustomActive(false);
    }
  }, [isCustomValue, matchedOption, trimmedValue]);

  const selectedValue =
    customActive && !trimmedValue
      ? CUSTOM_VALUE
      : !trimmedValue
        ? SYSTEM_VALUE
        : (matchedOption?.appName ?? CUSTOM_VALUE);
  const selectedLabel =
    customActive && !trimmedValue
      ? "自定义"
      : !trimmedValue
        ? defaultLabel
        : (matchedOption?.label ?? trimmedValue);
  const showCustomInput = customActive || isCustomValue;
  const defaultIcon = options.find((option) => systemIds?.has(option.id))?.icon;
  const selectedIcon = matchedOption?.icon ?? (!trimmedValue ? defaultIcon : undefined);
  const appIcon = (icon?: string) =>
    icon ? (
      <img src={icon} alt="" className="h-4 w-4 shrink-0 object-contain" />
    ) : (
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
    );

  const handleSelect = (nextValue: string) => {
    if (nextValue === SYSTEM_VALUE) {
      setCustomActive(false);
      onChange("");
      return;
    }
    if (nextValue === CUSTOM_VALUE) {
      setCustomActive(true);
      return;
    }
    setCustomActive(false);
    onChange(nextValue);
  };

  return (
    <div className={`space-y-3 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Icon
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Label htmlFor={`${id}-custom`} className="cursor-pointer">
              {title}
            </Label>
          </div>
          <p className="mt-1 pl-7 text-xs text-muted-foreground">
            {description}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 min-w-36 max-w-56 shrink-0 items-center justify-between gap-2 rounded-[10px] bg-[hsl(var(--background))] px-3 text-left text-sm text-foreground shadow-[inset_0_0_0_1px_hsl(var(--input))] transition-colors hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] focus:bg-[var(--goose-interactive-selected)] data-[state=open]:bg-[var(--goose-interactive-hover)]"
            >
              <span className="flex min-w-0 items-center gap-2">
                {appIcon(selectedIcon)}
                <span className="truncate">{selectedLabel}</span>
              </span>
              <LucideIcons.ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuRadioGroup
              value={selectedValue}
              onValueChange={handleSelect}
            >
              <DropdownMenuRadioItem value={SYSTEM_VALUE} hideIndicator>
                {appIcon(defaultIcon)}
                <span className="truncate">{defaultLabel}</span>
              </DropdownMenuRadioItem>
              {options.filter((option) => !systemIds?.has(option.id)).map((option) => (
                <DropdownMenuRadioItem key={option.id} value={option.appName} hideIndicator>
                  {appIcon(option.icon)}
                  <span className="truncate">{option.label}</span>
                </DropdownMenuRadioItem>
              ))}
              <DropdownMenuRadioItem value={CUSTOM_VALUE} hideIndicator>
                {appIcon()}
                <span>自定义</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showCustomInput && (
        <div className="pl-7">
          <Input
            id={`${id}-custom`}
            value={trimmedValue}
            onChange={(event) => onChange(event.target.value)}
            onBlur={(event) => onChange(event.target.value.trim())}
            placeholder={customPlaceholder}
            className="h-9 text-sm"
          />
        </div>
      )}
    </div>
  );
}

interface HiddenFoldersFieldProps {
  folders: string[];
  onChange: (folders: string[]) => void;
}

function HiddenFoldersField({ folders, onChange }: HiddenFoldersFieldProps) {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  const addFolder = (raw: string) => {
    const name = raw.trim();
    if (!name) {
      setError("请输入文件夹名称。");
      return;
    }
    if (folders.includes(name)) {
      setError("这个文件夹已经在列表中。");
      return;
    }
    onChange([...folders, name]);
    setInputValue("");
    setError("");
  };

  const removeFolder = (name: string) => {
    onChange(folders.filter((f) => f !== name));
  };

  const resetToDefault = () => {
    onChange([...DEFAULT_HIDDEN_FOLDERS]);
    setError("");
  };

  const isDefault =
    JSON.stringify(folders) === JSON.stringify(DEFAULT_HIDDEN_FOLDERS);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-base font-semibold">显示</h4>
        <span className="rounded-full bg-[var(--goose-interactive-selected)] px-3 py-1 text-xs text-[var(--goose-interactive-selected-fg)]">
          {folders.length} 项已隐藏
        </span>
      </div>
      <SettingsSectionCard className="overflow-hidden !p-0" contentClassName="!space-y-0">
        <div className={`flex items-center gap-4 p-5 ${SETTINGS_OPTION_ROW_CLASS} !rounded-none`}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]">
            <LucideIcons.EyeOff className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h5 className="font-semibold">隐藏文件夹</h5>
            <p className="mt-1 text-xs text-muted-foreground">
              隐藏指定名称的文件夹；原始文件保持不变。
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">当前规则</span>
            {!isDefault && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={resetToDefault}>
                恢复默认
              </Button>
            )}
          </div>
          {folders.length === 0 && <p className="py-3 text-sm text-muted-foreground">未隐藏任何文件夹</p>}
          {folders.map((folder) => {
            const isDefaultFolder = DEFAULT_HIDDEN_FOLDERS.includes(folder);
            return (
              <div key={folder} className="flex min-h-12 items-center gap-3 border-b border-border/70 py-2 last:border-0">
                <LucideIcons.FolderClosed className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 break-all text-sm font-medium">{folder}</span>
                {isDefaultFolder ? (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">默认隐藏 · 固定</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeFolder(folder)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-label={`移除 ${folder}`}
                  >
                    <LucideIcons.X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <details className="group border-t border-border/70">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-5 text-sm font-medium text-primary hover:bg-[var(--goose-interactive-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <LucideIcons.Plus className="h-4 w-4" /> 添加文件夹
          </summary>
          <form
            className="space-y-2 px-5 pb-5"
            onSubmit={(event) => { event.preventDefault(); addFolder(inputValue); }}
          >
            <Label htmlFor="local-folder-hidden-folder-input" className="text-xs">文件夹名称</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="local-folder-hidden-folder-input"
                value={inputValue}
                onChange={(event) => { setInputValue(event.target.value); setError(""); }}
                placeholder="例如 obsidian"
                className="h-9 min-w-36 flex-1 text-sm"
              />
              <Button type="submit" size="sm" className="h-9 shrink-0">添加</Button>
            </div>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          </form>
        </details>
      </SettingsSectionCard>
    </div>
  );
}

/** 桌面端专属：检测到旧内置（web-db）页面时，提供一次性导出为 .md 到当前仓库。 */
function LegacyInternalPagesExportCard() {
  const [exporting, setExporting] = useState(false);
  const [legacyCount, setLegacyCount] = useState(() =>
    listLegacyInternalPages().length,
  );
  if (legacyCount <= 0) return null;

  const handleExport = async () => {
    const notebookState = useNotebooks.getState();
    const activeNotebook = notebookState.activeNotebookId
      ? notebookState.notebooks[notebookState.activeNotebookId]
      : null;
    if (
      activeNotebook?.source !== "local-folder" ||
      !activeNotebook.localPath ||
      !window.gooseFs
    ) {
      toast.error("请先打开文件夹", {
        description: "切换到目标仓库后再导出旧内置笔记。",
      });
      return;
    }

    setExporting(true);
    try {
      const { blocksToMarkdown } = await import("@/lib/export");
      const gooseFs = window.gooseFs!;
      const basePath = activeNotebook.localPath.replace(/[\\/]+$/, "");
      const separator = activeNotebook.localPath.includes("\\") ? "\\" : "/";
      const legacyPages = listLegacyInternalPages();

      let exported = 0;
      for (const page of legacyPages) {
        const title = (getPageTitle(page) || "无标题")
          .trim()
          .replace(/[\\/:*?"<>|]/g, "_");
        const markdown = await blocksToMarkdown(page.content as never);
        let filePath = `${basePath}${separator}${title}.md`;
        let suffix = 1;
        const exists = async (path: string) =>
          gooseFs.existsAsync
            ? await gooseFs.existsAsync(path)
            : gooseFs.exists(path);
        while (await exists(filePath)) {
          filePath = `${basePath}${separator}${title} (${suffix}).md`;
          suffix += 1;
        }
        const ok = gooseFs.writeFileAsync
          ? await gooseFs.writeFileAsync(filePath, markdown)
          : gooseFs.writeFile(filePath, markdown);
        if (ok) exported += 1;
      }

      toast.success(`已导出 ${exported} 篇旧内置笔记`, {
        description: `已写入 ${basePath}；原始数据仍保留，未自动删除。`,
      });
      await usePages
        .getState()
        .loadLocalFolderPages(activeNotebook.id, activeNotebook.localPath);
    } catch (error) {
      console.error("[settings] 导出旧内置笔记失败", error);
      toast.error("导出失败，请重试");
    } finally {
      setExporting(false);
      setLegacyCount(listLegacyInternalPages().length);
    }
  };

  return (
    <SettingsSectionCard title="旧数据迁移">
      <div className="flex items-start justify-between gap-4 rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)] px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            检测到 {legacyCount} 篇旧内置笔记
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            这些笔记来自早期版本的内置存储，不会出现在侧栏。可一次性导出为
            Markdown 到当前仓库；导出不会删除原始数据。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={() => void handleExport()}
          className="shrink-0"
        >
          {exporting ? "导出中…" : "导出到当前文件夹"}
        </Button>
      </div>
    </SettingsSectionCard>
  );
}

export function SettingsLocalFolder({
  localFolderFileManager,
  setLocalFolderFileManager,
  localFolderExternalEditor,
  setLocalFolderExternalEditor,
  localFolderTerminal,
  setLocalFolderTerminal,
  localFolderHiddenFolders,
  setLocalFolderHiddenFolders,
}: SettingsLocalFolderProps) {
  const [fileManagerOptions, setFileManagerOptions] = useState<
    LocalFolderOpenAppCandidate[]
  >(() => getCachedAvailableOpenApps(LOCAL_FOLDER_FILE_MANAGER_CANDIDATES) ?? []);
  const [editorOptions, setEditorOptions] = useState<
    LocalFolderOpenAppCandidate[]
  >(() => getCachedAvailableOpenApps(LOCAL_FOLDER_EDITOR_CANDIDATES) ?? []);
  const [terminalOptions, setTerminalOptions] = useState<
    LocalFolderOpenAppCandidate[]
  >(() => getCachedAvailableOpenApps(LOCAL_FOLDER_TERMINAL_CANDIDATES) ?? []);
  const systemDefaultLabels = useMemo(() => getSystemDefaultLabels(), []);
  const hiddenFoldersRefreshNonceRef = useRef(0);
  const openAssetMaintenance = async () => {
    try {
      if (!window.gooseDesktop?.assetMaintenance) throw new Error("仅桌面应用支持资源清理");
      await window.gooseDesktop.assetMaintenance.open();
    } catch (error) { toast.error("无法打开资源清理窗口", { description: String(error) }); }
  };

  const handleHiddenFoldersChange = (folders: string[]) => {
    setLocalFolderHiddenFolders(folders);
    const refreshNonce = ++hiddenFoldersRefreshNonceRef.current;

    void (async () => {
      try {
        // 重扫会替换 workspace 页面集合；先把编辑器最新内容推进保存队列并等待本地写盘，
        // 避免用户刚编辑完就修改隐藏目录时丢失未落盘内容。
        window.dispatchEvent(
          new CustomEvent("goose-note:flush-editor", {
            detail: { immediate: true },
          }),
        );
        await usePages.getState().flushPendingLocalSaves();
        if (refreshNonce !== hiddenFoldersRefreshNonceRef.current) return;

        const pagesState = usePages.getState();
        const notebookState = useNotebooks.getState();
        const loadedWorkspaceIds = new Set(
          Object.values(pagesState.pages).map((page) => page.workspaceId),
        );
        Object.entries(notebookState.localFolderLoadStates).forEach(
          ([notebookId, state]) => {
            if (state.status === "ready") loadedWorkspaceIds.add(notebookId);
          },
        );
        if (notebookState.activeNotebookId) {
          loadedWorkspaceIds.add(notebookState.activeNotebookId);
        }

        let skippedDirtyNotebook = false;
        for (const notebookId of loadedWorkspaceIds) {
          const notebook = notebookState.notebooks[notebookId];
          if (notebook?.source !== "local-folder" || !notebook.localPath)
            continue;

          const currentPages = usePages.getState();
          const hasDirtyPage = Object.entries(
            currentPages.dirtyLocalPageIds,
          ).some(
            ([pageId, dirty]) =>
              dirty && currentPages.pages[pageId]?.workspaceId === notebookId,
          );
          if (hasDirtyPage) {
            skippedDirtyNotebook = true;
            continue;
          }

          await currentPages.loadLocalFolderPages(
            notebook.id,
            notebook.localPath,
          );
        }

        if (skippedDirtyNotebook) {
          toast.warning("部分本地文件夹仍有未保存内容，已暂缓刷新隐藏目录");
        }
      } catch (error) {
        console.error("[settings] 刷新本地文件夹隐藏目录失败", error);
        toast.error("刷新隐藏目录失败", {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  };

  useEffect(() => {
    let cancelled = false;

    const applyAvailableApps = (
      fileManagers: LocalFolderOpenAppCandidate[],
      editors: LocalFolderOpenAppCandidate[],
      terminals: LocalFolderOpenAppCandidate[],
    ) => {
      setFileManagerOptions(fileManagers);
      setEditorOptions(editors);
      setTerminalOptions(terminals);
    };

    const cachedFileManagers = getCachedAvailableOpenApps(
      LOCAL_FOLDER_FILE_MANAGER_CANDIDATES,
    );
    const cachedEditors = getCachedAvailableOpenApps(
      LOCAL_FOLDER_EDITOR_CANDIDATES,
    );
    const cachedTerminals = getCachedAvailableOpenApps(
      LOCAL_FOLDER_TERMINAL_CANDIDATES,
    );

    if (cachedFileManagers && cachedEditors && cachedTerminals) {
      applyAvailableApps(cachedFileManagers, cachedEditors, cachedTerminals);
      return () => {
        cancelled = true;
      };
    }

    const loadAvailableApps = async () => {
      const [fileManagers, editors, terminals] = await Promise.all([
        shell.listAvailableOpenApps(LOCAL_FOLDER_FILE_MANAGER_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_EDITOR_CANDIDATES),
        shell.listAvailableOpenApps(LOCAL_FOLDER_TERMINAL_CANDIDATES),
      ]);

      if (cancelled) return;
      applyAvailableApps(fileManagers, editors, terminals);
    };

    void loadAvailableApps();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        本地文件夹
      </h3>

      <div className="settings-card-columns">
        <div className="space-y-5">
      {isElectronHost && <LegacyInternalPagesExportCard />}

      <SettingsSectionCard title="打开方式">
        <div className="space-y-3">
          <OpenAppField
            id="local-folder-file-manager"
            title="文件管理器"
            description="右键打开或显示本地文件时使用。"
            icon={LucideIcons.FolderOpen}
            value={localFolderFileManager}
            onChange={setLocalFolderFileManager}
            defaultLabel={systemDefaultLabels.fileManager}
            customPlaceholder="如：Path Finder"
            options={fileManagerOptions}
            systemIds={SYSTEM_FILE_MANAGER_IDS}
          />
          <OpenAppField
            id="local-folder-editor"
            title="编辑器"
            description="右键用外部应用打开文件或文件夹时使用。"
            icon={LucideIcons.SquarePen}
            value={localFolderExternalEditor}
            onChange={setLocalFolderExternalEditor}
            defaultLabel="系统默认"
            customPlaceholder="如：Cursor、Zed、code -r"
            options={editorOptions}
          />
          <OpenAppField
            id="local-folder-terminal"
            title="终端"
            description="右键在终端中打开目录时使用。"
            icon={LucideIcons.Terminal}
            value={localFolderTerminal}
            onChange={setLocalFolderTerminal}
            defaultLabel={systemDefaultLabels.terminal}
            customPlaceholder="如：Ghostty、iTerm、wezterm"
            options={terminalOptions}
            systemIds={SYSTEM_TERMINAL_IDS}
          />
        </div>
      </SettingsSectionCard>

        </div>
        <div className="space-y-5">
      <HiddenFoldersField
        folders={localFolderHiddenFolders}
        onChange={handleHiddenFoldersChange}
      />

      <SettingsSectionCard title="存储维护">
        <div
          className={`flex items-center justify-between gap-4 p-4 ${SETTINGS_OPTION_ROW_CLASS}`}
        >
          <div>
            <div className="flex items-center gap-3">
              <LucideIcons.Trash2
                className="h-4 w-4 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Label>清理未引用图片与视频</Label>
            </div>
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              按笔记本扫描，确认后移入废纸篓。
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            onClick={() => void openAssetMaintenance()}
          >
            打开资源清理
          </Button>
        </div>
      </SettingsSectionCard>

        </div>
      </div>
    </div>
  );
}
