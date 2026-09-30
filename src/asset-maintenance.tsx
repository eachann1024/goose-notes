import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChevronDown, Film, Image as ImageIcon, ScanSearch, Trash2 } from "lucide-react";
import { Checkbox } from "@heroui/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSettings } from "@/stores/useSettings";
import { applyFontVariables } from "@/lib/fontLoader";
import { applyAppearanceScaleVariables } from "@/lib/appearance";
import { getLocalAssetKind } from "@/lib/local-folder-asset-maintenance";
import type { AssetNotebook, AssetScan } from "@/lib/asset-maintenance-contract";
import "./index.css";
import "./fonts.css";

const bridge = window.gooseDesktop!.assetMaintenance;
type Asset = AssetScan["assets"][number];
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function AssetIcon({ asset }: { asset: Asset }) {
  return getLocalAssetKind(asset.name) === "video" ? <Film className="h-6 w-6" aria-hidden="true" /> : <ImageIcon className="h-6 w-6" aria-hidden="true" />;
}
function Preview({ asset, thumbnail = false }: { asset: Asset; thumbnail?: boolean }) {
  const [failed, setFailed] = useState(false);
  const video = getLocalAssetKind(asset.name) === "video";
  if (failed || (thumbnail && video)) return <span className="flex flex-col items-center gap-2 text-muted-foreground"><AssetIcon asset={asset} />{!thumbnail && <span className="text-sm">无法预览此格式，文件仍保留</span>}</span>;
  if (video) return <video src={asset.previewUrl} controls preload="metadata" aria-label={asset.name} className="max-h-full max-w-full rounded-lg" onError={() => setFailed(true)} />;
  return <img src={asset.previewUrl} alt={thumbnail ? "" : asset.name} loading={thumbnail ? "lazy" : "eager"} className="max-h-full max-w-full rounded-lg object-contain" onError={() => setFailed(true)} />;
}

function AssetMaintenanceApp() {
  const [notebooks, setNotebooks] = useState<AssetNotebook[]>([]);
  const [notebookId, setNotebookId] = useState("");
  const [scan, setScan] = useState<AssetScan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const preview = scan?.assets.find((asset) => asset.path === previewPath);
  const selectedNotebook = notebooks.find((notebook) => notebook.id === notebookId);
  const allSelected = !!scan?.assets.length && selected.size === scan.assets.length;
  const partiallySelected = selected.size > 0 && !allSelected;
  const loadNotebooks = async () => {
    setLoading(true); setError("");
    try { setNotebooks(await bridge.notebooks()); }
    catch (error) { setError(String(error)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadNotebooks(); }, []);
  const clearScan = () => { setScan(null); setSelected(new Set()); setPreviewPath(null); };
  const runScan = async () => {
    if (!notebookId || busy) return;
    setBusy(true); setError(""); setMessage(""); clearScan();
    try { setScan(await bridge.scan(notebookId)); }
    catch (error) { setError(String(error)); }
    finally { setBusy(false); }
  };
  const trash = async () => {
    if (!scan || !selected.size || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await bridge.trash(scan.token, [...selected]);
      if (!result.canceled) { clearScan(); setMessage(`已将 ${result.deleted} 个文件移入系统废纸篓。继续清理请重新扫描。`); }
    } catch (error) { clearScan(); setError(String(error)); }
    finally { setBusy(false); }
  };
  const toggle = (path: string) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });
  return <main className="flex h-screen flex-col gap-4 bg-background p-6 text-foreground">
    <header className="space-y-2">
      <h1 className="text-xl font-semibold">清理未引用图片与视频</h1>
      <p className="text-sm text-muted-foreground">先选择一个本地文件夹笔记本，再扫描其中 assets 目录的图片和视频。不处理脚本、样式、网页、PDF、音频或其他文件。</p>
      <p className="text-xs text-muted-foreground">检查磁盘全部 Markdown（含隐藏目录）及所有工作区未保存编辑。读取失败会停止；扫描不会自动恢复废纸篓。</p>
    </header>
    <div className="flex items-end gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Label id="asset-notebook-label" htmlFor="asset-notebook">本地文件夹笔记本</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              id="asset-notebook"
              type="button"
              variant="outline"
              disabled={busy || loading}
              aria-labelledby="asset-notebook-label asset-notebook-value"
              className="w-full justify-between text-left font-normal"
            >
              <span id="asset-notebook-value" className="truncate" title={selectedNotebook?.localPath}>
                {selectedNotebook ? `${selectedNotebook.name} — ${selectedNotebook.localPath}` : loading ? "正在读取笔记本…" : "请选择笔记本（不会自动扫描）"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-96 max-w-full">
            <DropdownMenuRadioGroup
              value={notebookId}
              onValueChange={(value) => { setNotebookId(value); clearScan(); setError(""); setMessage(""); }}
            >
              <DropdownMenuRadioItem value="" textValue="请选择笔记本（不会自动扫描）">请选择笔记本（不会自动扫描）</DropdownMenuRadioItem>
              {notebooks.map((notebook) => (
                <DropdownMenuRadioItem key={notebook.id} value={notebook.id} textValue={`${notebook.name} — ${notebook.localPath}`}>
                  <span className="min-w-0" title={notebook.localPath}>
                    <span className="block truncate">{notebook.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{notebook.localPath}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Button variant="secondary" disabled={busy || loading} onClick={() => { clearScan(); setNotebookId(""); void loadNotebooks(); }}>刷新列表</Button>
      <Button disabled={!notebookId || busy || loading} onClick={() => void runScan()}><ScanSearch />{busy ? "正在处理…" : "扫描资源"}</Button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-muted p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <div className="flex min-h-0 flex-1 gap-4">
      <section aria-label="未引用资源列表" className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border p-3 text-sm">
          <Checkbox
            aria-label="全选资源"
            isDisabled={busy || !scan?.assets.length}
            isSelected={allSelected}
            isIndeterminate={partiallySelected}
            onChange={(checked) => setSelected(checked ? new Set(scan?.assets.map((asset) => asset.path)) : new Set())}
            className="min-h-6 gap-2"
          >
            <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
            <span className="text-sm font-medium">全选</span>
          </Checkbox>
          <span className="text-muted-foreground">{scan ? `${scan.assets.length} 个 · ${formatSize(scan.assets.reduce((sum, asset) => sum + asset.size, 0))}` : "尚未扫描"}</span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2">
            {!scan && <p className="p-6 text-sm text-muted-foreground">{busy ? "正在检查引用，请稍候…" : "选择笔记本并点击“扫描资源”后显示结果。"}</p>}
            {scan?.assets.length === 0 && <p className="p-6 text-sm text-muted-foreground">没有发现未引用的图片或视频。</p>}
            {scan?.assets.map((asset) => <div key={asset.path} className={`mb-2 flex items-center gap-3 rounded-lg p-2 ${previewPath === asset.path ? "bg-accent" : "hover:bg-muted"}`}>
              <Checkbox aria-label={`选择 ${asset.name}`} isSelected={selected.has(asset.path)} isDisabled={busy} onChange={() => toggle(asset.path)} className="min-h-6 min-w-6 shrink-0 justify-center">
                <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
              </Checkbox>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setPreviewPath(asset.path)} aria-label={`预览 ${asset.name}`} aria-pressed={previewPath === asset.path} className="h-auto min-w-0 flex-1 justify-start gap-3 p-2 text-left">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted"><Preview key={`${scan.token}:${asset.path}`} asset={asset} thumbnail /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{asset.name}</span><span className="block truncate text-xs text-muted-foreground" title={asset.path}>{asset.relativePath}</span><span className="text-xs text-muted-foreground">{getLocalAssetKind(asset.name) === "video" ? "视频" : "图片"} · {formatSize(asset.size)}</span></span>
                <AssetIcon asset={asset} />
              </Button>
            </div>)}
          </div>
        </ScrollArea>
      </section>
      <section aria-label="资源预览" className="flex w-1/3 min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">预览</h2>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-muted">{preview ? <Preview key={`${scan?.token}:${preview.path}`} asset={preview} /> : <p className="p-4 text-sm text-muted-foreground">点击资源查看图片或播放视频</p>}</div>
        {preview && <div className="space-y-2 text-sm"><p className="break-all font-medium">{preview.name}</p><p className="break-all text-xs text-muted-foreground">{preview.path}</p><p className="text-muted-foreground">{formatSize(preview.size)}</p></div>}
      </section>
    </div>
    <footer className="flex items-center justify-between gap-4"><p className="text-xs text-muted-foreground">已选择 {selected.size} 个。删除前再次检查引用；扫描结果 10 分钟内有效。</p><Button variant="destructive" disabled={busy || !selected.size} onClick={() => void trash()}><Trash2 />移入系统废纸篓</Button></footer>
  </main>;
}

async function start() {
  await useSettings.persist.rehydrate();
  const appearance = await bridge.appearance();
  useSettings.setState(appearance);
  useSettings.getState().setTheme(appearance.theme);
  useSettings.getState().setAccentColor(appearance.accentColor);
  const settings = useSettings.getState();
  applyFontVariables(settings.customFonts, settings);
  applyAppearanceScaleVariables({ uiFontSize: settings.uiFontSize, editorFontSize: settings.editorFontSize, editorLineHeight: settings.editorLineHeight, sidebarFontSize: settings.sidebarFontSize });
  createRoot(document.getElementById("root")!).render(<AssetMaintenanceApp />);
}
void start().catch((error) => { document.getElementById("root")!.textContent = `资源清理窗口初始化失败：${String(error)}`; });
