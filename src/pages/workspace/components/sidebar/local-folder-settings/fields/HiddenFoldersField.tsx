import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import * as GooseIcons from "@/components/ui/icons";
import { SettingsSectionCard } from "../../settings/SettingsSectionCard";
import {
  DEFAULT_HIDDEN_FOLDERS,
  SETTINGS_OPTION_ROW_CLASS,
  type HiddenFoldersFieldProps,
} from "./localFolderSettingsConfig";

export function HiddenFoldersField({
  folders,
  onChange,
}: HiddenFoldersFieldProps) {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  const addFolder = (raw: string) => {
    const name = raw.trim();
    if (!name) {
      setError("请输入文件夹名称。");
      return;
    }
    if (folders.includes(name)) {
      setError("该文件夹已在隐藏列表中。");
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
        <span className="rounded-control bg-[var(--goose-interactive-selected)] px-3 py-1 text-xs text-[var(--goose-interactive-selected-fg)]">
          {folders.length} 项已隐藏
        </span>
      </div>
      <SettingsSectionCard
        className="overflow-hidden !p-0"
        contentClassName="!space-y-0"
      >
        <div
          className={`flex items-center gap-4 p-5 ${SETTINGS_OPTION_ROW_CLASS} !rounded-none`}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--goose-interactive-selected)] text-[var(--goose-interactive-selected-fg)]">
            <GooseIcons.EyeOff className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h5 className="font-semibold">隐藏文件夹</h5>
            <p className="mt-1 text-xs text-muted-foreground">
              在侧栏中过滤指定名称的文件夹；磁盘中的实际文件保持不变。
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              当前规则
            </span>
            {!isDefault && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={resetToDefault}
              >
                恢复默认
              </Button>
            )}
          </div>
          {folders.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">
              暂无隐藏文件夹
            </p>
          )}
          {folders.map((folder) => {
            const isDefaultFolder = DEFAULT_HIDDEN_FOLDERS.includes(folder);
            return (
              <div
                key={folder}
                className="flex min-h-12 items-center gap-3 border-b border-border/70 py-2 last:border-0"
              >
                <GooseIcons.FolderClosed
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <span className="min-w-0 flex-1 break-all text-sm font-medium">
                  {folder}
                </span>
                {isDefaultFolder ? (
                  <span className="shrink-0 rounded-control border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    预置规则 · 始终隐藏
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeFolder(folder)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-hover-fg)] "
                    aria-label={`移除 ${folder}`}
                  >
                    <GooseIcons.X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <details className="group border-t border-border/70">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-5 text-sm font-medium text-link hover:bg-[var(--goose-interactive-hover)] [&::-webkit-details-marker]:hidden">
            <GooseIcons.Plus className="h-4 w-4" /> 添加隐藏文件夹
          </summary>
          <form
            className="space-y-2 px-5 pb-5"
            onSubmit={(event) => {
              event.preventDefault();
              addFolder(inputValue);
            }}
          >
            <Label
              htmlFor="local-folder-hidden-folder-input"
              className="text-xs"
            >
              文件夹名称
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="local-folder-hidden-folder-input"
                value={inputValue}
                onChange={(event) => {
                  setInputValue(event.target.value);
                  setError("");
                }}
                placeholder="例如 .obsidian"
                className="h-9 min-w-36 flex-1 text-sm"
              />
              <Button type="submit" size="sm" className="h-9 shrink-0">
                添加
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}
          </form>
        </details>
      </SettingsSectionCard>
    </div>
  );
}
