import { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox } from "@heroui/react";
import { ChevronDown, LoaderCircle } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsSectionCard } from "./SettingsSectionCard";
import { DEFAULT_GIT_SYNC_INTERVAL, normalizedGitRemote, validateGitRepository, type GitRepositoryConfig, type GitRepositoryFolder, type GitRepositoryInput, type GitSyncBridge, type GitSyncState } from "@/lib/git-sync-contract";
import { useNotebooks } from "@/stores/useNotebooks";

type Draft = Pick<GitRepositoryInput, "provider" | "remoteUrl" | "branch" | "intervalMinutes" | "enabled">;
const emptyDraft = (): Draft => ({ provider: "github", remoteUrl: "", branch: "main", intervalMinutes: DEFAULT_GIT_SYNC_INTERVAL, enabled: true });
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error || "操作失败，请重试");
const spinner = <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />;

function VisibilityBadge({ config, checking }: { config: GitRepositoryConfig; checking: boolean }) {
  if (checking) return <Badge variant="secondary" className="shrink-0 gap-1">{spinner}检查中</Badge>;
  const value = config.visibility.value;
  const tone = value === "private" ? "success" : value === "public" ? "warning" : null;
  return <Badge variant="outline" className="shrink-0 text-muted-foreground" style={tone ? {
    borderColor: `var(--goose-interactive-${tone}-border)`,
    backgroundColor: `var(--goose-interactive-${tone})`,
    color: `var(--goose-interactive-${tone}-fg)`,
  } : undefined}>
    {value === "private" ? "私有" : value === "public" ? "公开 · 注意隐私" : "可见性未知"}
  </Badge>;
}

// The backend persists and restores mappings on re-selection; the UUID suffix avoids
// collisions between names that normalize to the same portable directory name.
function newRemotePath(name: string) {
  const slug = name.normalize("NFKD").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^[^A-Za-z0-9]+|[-_]+$/g, "").slice(0, 50) || "notebook";
  return `${slug}-${crypto.randomUUID()}`;
}

export function SettingsGitSync({ visible = true }: { visible?: boolean }) {
  const notebooks = useNotebooks((store) => store.notebooks);
  const localNotebooks = useMemo(() => Object.values(notebooks).filter((item) => item.source === "local-folder" && item.localPath), [notebooks]);
  const [bridge] = useState(() => (window as Window & { gooseDesktop?: { gitSync?: GitSyncBridge } }).gooseDesktop?.gitSync);
  const [state, setState] = useState<GitSyncState>({ configs: [], statuses: [] });
  const [loading, setLoading] = useState(Boolean(bridge));
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const [adding, setAdding] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, string>>({});
  const locks = useRef(new Set<string>());
  const mappings = useRef(new Map<string, GitRepositoryFolder>());
  const [removeConfirmation, setRemoveConfirmation] = useState("");
  const [folderChecks, setFolderChecks] = useState<Record<string, { error: string | null }>>({});
  const [checkRevision, setCheckRevision] = useState(0);

  useEffect(() => {
    if (!bridge || !visible) return;
    let mounted = true;
    const apply = (next: GitSyncState) => { if (mounted) setState(next); };
    const unsubscribe = bridge.onState(apply);
    bridge.getState().then(apply).catch((error: unknown) => { if (mounted) setLoadError(messageOf(error)); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; unsubscribe(); };
  }, [bridge, reload, visible]);

  useEffect(() => {
    for (const config of state.configs) for (const folder of config.folders) mappings.current.set(`${config.id}:${folder.notebookId}`, folder);
  }, [state.configs]);

  const config = adding ? undefined : state.configs.find((item) => item.id === selectedId) ?? state.configs[0];
  useEffect(() => {
    if (!bridge || !visible || !config) return;
    let active = true;
    setFolderChecks({});
    const paths = new Set([...localNotebooks.map((notebook) => notebook.localPath!), ...config.folders.map((folder) => folder.localPath)]);
    void (async () => {
      for (const localPath of paths) {
        const result = await bridge.checkFolder(localPath).catch((error: unknown) => ({ error: messageOf(error) }));
        if (!active) return;
        setFolderChecks((current) => ({ ...current, [localPath]: result }));
      }
    })();
    return () => { active = false; };
  }, [bridge, visible, config, localNotebooks, checkRevision]);

  const id = config?.id ?? newId;
  const draft = drafts[id] ?? config ?? emptyDraft();
  const dirty = Boolean(drafts[id]);
  const status = state.statuses.find((item) => item.repositoryId === id);
  const pending = busy[id];
  const syncing = status?.phase === "syncing";
  const disabled = loading || Boolean(loadError) || Boolean(pending) || syncing;
  const checking = (item: GitRepositoryConfig) => busy[item.id] === "检查可见性" || item.visibility.reason === "正在检查";
  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => setDrafts((current) => ({ ...current, [id]: { ...draft, [key]: value } }));

  async function run(repositoryId: string, label: string, operation: () => Promise<GitSyncState>, onSuccess?: () => void) {
    if (!bridge || locks.current.has(repositoryId)) return;
    locks.current.add(repositoryId);
    setBusy((current) => ({ ...current, [repositoryId]: label }));
    setErrors((current) => ({ ...current, [repositoryId]: "" }));
    try { setState(await operation()); onSuccess?.(); }
    catch (error) { setErrors((current) => ({ ...current, [repositoryId]: `${label}失败：${messageOf(error)}` })); }
    finally { locks.current.delete(repositoryId); setBusy((current) => ({ ...current, [repositoryId]: "" })); }
  }

  function validate(input: GitRepositoryInput) {
    const valid = validateGitRepository(input);
    if (state.configs.some((other) => other.id !== valid.id && normalizedGitRemote(other) === normalizedGitRemote(valid) && other.branch === valid.branch)) throw new Error("此仓库分支已有同步配置，请选择已有仓库");
    return valid;
  }

  function save() {
    if (!bridge || disabled) return;
    void run(id, "保存配置", () => bridge.save(validate({ id, ...draft, layout: config?.layout ?? "subfolders", folders: config?.folders ?? [] })), () => {
      setDrafts((current) => { const next = { ...current }; delete next[id]; return next; });
      if (!config) {
        setSelectedId(id);
        setAdding(false);
        setNewId(crypto.randomUUID());
      }
    });
  }

  function toggleFolder(folder: GitRepositoryFolder, checked: boolean) {
    if (!bridge || !config || disabled || (checked && (!folderChecks[folder.localPath] || folderChecks[folder.localPath].error))) return;
    const folders = checked ? [...config.folders, folder] : config.folders.filter((item) => item.notebookId !== folder.notebookId);
    // Use saved settings, so a checkbox never silently commits the repository form.
    void run(id, checked ? "保存选择并同步" : "保存选择", () => bridge.save(validate({ ...config, folders })));
  }

  function checkVisibility(clear = false) {
    if (!bridge || !config || disabled) return;
    const token = tokens[id]?.trim();
    setTokens((current) => ({ ...current, [id]: "" }));
    void run(id, "检查可见性", () => bridge.checkVisibility({ repositoryId: id, ...(clear ? { token: null } : token ? { token } : {}) }));
  }

  const rows: GitRepositoryFolder[] = localNotebooks.map((notebook) => {
    const saved = config?.folders.find((folder) => folder.notebookId === notebook.id);
    return saved ?? { notebookId: notebook.id, localPath: notebook.localPath!, name: notebook.name, remotePath: "" };
  });
  for (const folder of config?.folders ?? []) if (!rows.some((row) => row.notebookId === folder.notebookId)) rows.push(folder);

  const selectedFolderError = config?.folders.some((folder) => Boolean(folderChecks[folder.localPath]?.error));
  const nameCounts = new Map<string, number>();
  for (const folder of rows) nameCounts.set(folder.name, (nameCounts.get(folder.name) ?? 0) + 1);

  return <div className="min-w-0 space-y-5">
    <div><h3 className="text-xl font-semibold tracking-tight text-foreground">Git 同步</h3><p className="mt-1 text-sm text-muted-foreground">添加 GitHub 或 Gitee 仓库，为每个仓库选择多个本地笔记本。</p></div>
    {!bridge ? <SettingsSectionCard><p className="text-sm text-muted-foreground">Git 同步仅在桌面版应用中可用。</p></SettingsSectionCard> : <>
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">{spinner}正在读取同步配置…</p>}
      {loadError && <div role="alert" className="space-y-2 text-sm"><p className="git-sync-error">读取配置失败：{loadError}</p><Button variant="outline" onClick={() => { setLoadError(""); setLoading(true); setReload((value) => value + 1); }}>重新读取</Button></div>}
      <SettingsSectionCard title="仓库" description="建议使用私有仓库，避免笔记被公开。">
        <div className="space-y-2">
          {state.configs.map((item) => <Button key={item.id} variant={config?.id === item.id ? "secondary" : "outline"} aria-pressed={config?.id === item.id} onClick={() => { setSelectedId(item.id); setAdding(false); setRemoveConfirmation(""); }} className="h-auto w-full min-w-0 flex-wrap justify-start gap-2 p-3 text-left">
            <span className="min-w-0 flex-1"><span className="block truncate" title={item.remoteUrl}>{item.remoteUrl}</span><span className="block truncate text-xs font-normal text-muted-foreground">{item.branch} · {item.folders.length} 个文件夹{busy[item.id] ? ` · ${busy[item.id]}…` : state.statuses.find((entry) => entry.repositoryId === item.id)?.phase === "syncing" ? " · 同步中…" : ""}</span></span>
            <VisibilityBadge config={item} checking={checking(item)} />
          </Button>)}
          {!loading && !loadError && !state.configs.length && <p className="text-sm text-muted-foreground">尚未添加仓库。先保存 SSH 地址，再勾选文件夹。</p>}
        </div>
        <Button variant="outline" disabled={loading || Boolean(loadError) || adding || (!config && dirty)} onClick={() => { setAdding(true); setRemoveConfirmation(""); }}>添加仓库</Button>
      </SettingsSectionCard>
      {adding && !loading && !loadError && <SettingsSectionCard title="添加仓库">
        <div className="space-y-2"><Label htmlFor="git-sync-provider">Git 平台</Label><DropdownMenu><DropdownMenuTrigger asChild><Button id="git-sync-provider" variant="outline" disabled={disabled || Boolean(config)} className="w-full justify-between font-normal"><span>{draft.provider === "github" ? "GitHub" : "Gitee"}</span><ChevronDown aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" aria-label="Git 平台" className="min-w-[var(--trigger-width)]"><DropdownMenuRadioGroup value={draft.provider} onValueChange={(value) => updateDraft("provider", value as Draft["provider"])}><DropdownMenuRadioItem hideIndicator value="github">GitHub</DropdownMenuRadioItem><DropdownMenuRadioItem hideIndicator value="gitee">Gitee</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu></div>
        <div className="space-y-2"><Label htmlFor="git-sync-remote">SSH 仓库地址</Label><Input id="git-sync-remote" value={draft.remoteUrl} disabled={disabled || Boolean(config)} onChange={(event) => updateDraft("remoteUrl", event.target.value)} placeholder={`git@${draft.provider === "github" ? "github.com" : "gitee.com"}:用户名/仓库.git`} autoComplete="off" /></div>
        <div className="space-y-2"><Label htmlFor="git-sync-branch">分支</Label><Input id="git-sync-branch" value={draft.branch} disabled={disabled || Boolean(config)} onChange={(event) => updateDraft("branch", event.target.value)} /></div>
        </SettingsSectionCard>}
      {(config || (adding && !loading && !loadError)) && <SettingsSectionCard title="自动同步">
        <div className="space-y-2"><Label htmlFor="git-sync-interval">自动同步间隔（分钟）</Label><Input id="git-sync-interval" type="number" min={1} max={1440} step={1} value={draft.intervalMinutes} disabled={disabled} onChange={(event) => updateDraft("intervalMinutes", Number(event.target.value))} /></div>
        <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 p-4"><div><Label htmlFor="git-sync-enabled">自动同步</Label><p className="mt-1 text-xs text-muted-foreground">应用运行期间定时同步；新增勾选始终立即同步一次。</p></div><Switch id="git-sync-enabled" checked={draft.enabled} disabled={disabled} onCheckedChange={(checked) => updateDraft("enabled", checked)} /></div>
        <div className="flex flex-wrap items-center gap-2"><Button onClick={save} disabled={disabled || (Boolean(config) && !dirty)}>{config ? "保存同步设置" : "添加仓库"}</Button>{adding && state.configs.length > 0 && <Button variant="outline" disabled={disabled} onClick={() => setAdding(false)}>取消添加</Button>}{dirty && <><span className="text-xs text-muted-foreground">有未保存的设置</span><Button variant="ghost" disabled={disabled} onClick={() => setDrafts((current) => { const next = { ...current }; delete next[id]; return next; })}>撤销编辑</Button></>}</div>
      </SettingsSectionCard>}
      {config && <>
        <SettingsSectionCard title="仓库可见性">
          <div className="flex flex-wrap items-center gap-2"><VisibilityBadge config={config} checking={checking(config)} />{config.visibility.checkedAt && <span className="text-xs text-muted-foreground">检查于 {new Date(config.visibility.checkedAt).toLocaleString()}</span>}</div>
          <p className="break-words text-sm text-muted-foreground">{checking(config) ? "正在检查仓库元数据…" : config.visibility.value === "public" ? "该仓库公开可见，推送的笔记可能被任何人阅读。建议先在平台改为私有仓库，再重新检查。" : config.visibility.reason || (config.visibility.value === "private" ? "平台已确认该仓库为私有。" : "尚未确认仓库可见性，请检查。")}</p>
          <div className="space-y-2"><Label htmlFor="git-sync-token">API Token（可选，仅用于检查可见性）</Label><Input id="git-sync-token" type="password" autoComplete="off" spellCheck={false} value={tokens[id] ?? ""} disabled={disabled} onChange={(event) => setTokens((current) => ({ ...current, [id]: event.target.value }))} placeholder={config.hasToken ? "已安全保存凭据，留空可复用" : "私有仓库可能需要读取仓库元数据的权限"} /><p className="text-xs text-muted-foreground">Token 仅用于查询仓库是否私有，会由系统加密保存，不用于传输笔记；文件始终通过 SSH 同步。检查后输入框清空，不显示已保存的 Token。</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled} onClick={() => checkVisibility()}>{checking(config) ? spinner : null}{checking(config) ? "检查中…" : "重新检查可见性"}</Button>{config.hasToken && <Button variant="ghost" disabled={disabled} onClick={() => checkVisibility(true)}>清除凭据并重新检查</Button>}</div>
        </SettingsSectionCard>
        <SettingsSectionCard title="同步文件夹" description="勾选后立即保存并同步；取消勾选不会删除文件。" contentClassName="space-y-2" actions={<Button variant="ghost" size="sm" disabled={disabled} onClick={() => setCheckRevision((value) => value + 1)}>重新检查</Button>}>
          {config.layout === "legacy-root" && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">这是旧版根目录布局，仅支持原来的一个文件夹，远端路径保持仓库根目录。要同步多个文件夹，请添加另一个仓库的配置；不会自动迁移旧布局。</p>}
          {!rows.length && <p className="text-sm text-muted-foreground">暂无本地文件夹笔记本，请先在侧栏添加本地笔记本。</p>}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-2">{rows.map((folder) => {
            const selected = config.folders.some((item) => item.notebookId === folder.notebookId);
            const available = localNotebooks.some((item) => item.id === folder.notebookId);
            const check = folderChecks[folder.localPath];
            const folderError = !available ? "笔记本未打开" : check?.error;
            const duplicateName = (nameCounts.get(folder.name) ?? 0) > 1;
            return <div key={folder.notebookId} className="min-w-0 rounded-lg bg-muted/50 p-3"><Checkbox className="min-h-6 w-full min-w-0 items-center gap-2" aria-label={`同步 ${folder.name}${duplicateName ? ` ${folder.localPath}` : ""}`} isSelected={selected} isDisabled={disabled || (!selected && (!available || !check || Boolean(folderError))) || (config.layout === "legacy-root" && !selected && config.folders.length > 0)} onChange={(checked) => {
              const key = `${id}:${folder.notebookId}`;
              const mapping = mappings.current.get(key) ?? { ...folder, remotePath: config.layout === "legacy-root" ? "" : newRemotePath(folder.name) };
              mappings.current.set(key, mapping);
              toggleFolder(mapping, checked);
            }}><Checkbox.Control className="shrink-0"><Checkbox.Indicator /></Checkbox.Control><span className="min-w-0 flex-1"><span className={"block truncate text-sm font-medium " + (!selected && folderError ? "text-disabled" : "text-foreground")} title={folder.name}>{folder.name}</span>{duplicateName && <span className="block truncate text-xs text-muted-foreground" title={folder.localPath}>{folder.localPath}</span>}</span></Checkbox>{folderError ? <p className="mt-1 text-xs text-danger" title={folderError}>{folderError.split("\n")[0]}{selected ? " 请取消勾选。" : ""}</p> : !check ? <p className="mt-1 text-xs text-muted-foreground">检查中…</p> : null}</div>;
          })}</div>
        </SettingsSectionCard>
        <SettingsSectionCard title="同步状态">
          {selectedFolderError && <p className="text-sm text-danger">已选文件夹有错误，请修复后重新检查，或取消勾选后再同步。</p>}
          <div role="status" aria-live="polite" className="space-y-2 text-sm"><p className="flex items-center gap-2">{(pending || syncing) && spinner}{syncing ? "正在同步所选文件夹…" : pending ? `${pending}…` : status?.phase === "error" ? "同步失败" : "等待同步"}</p><p className="text-muted-foreground">上次成功：{status?.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : "尚无记录"}</p></div>
          {status?.error && <p role="alert" className="git-sync-error rounded-lg border p-3 text-sm">{status.error}</p>}
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled || !config.folders.length || selectedFolderError} onClick={() => void run(id, "同步", () => bridge.syncNow(id))}>{status?.phase === "error" ? "重试同步" : "立即同步"}</Button><Button variant="ghost" disabled={disabled} onClick={() => setRemoveConfirmation(id)}>移除配置</Button></div>
          {removeConfirmation === id && <div className="space-y-2 rounded-lg border border-border p-3"><p className="text-sm text-muted-foreground">仅移除本应用的同步配置和检查凭据，保留本地与远端文件。</p><div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={disabled} onClick={() => void run(id, "移除配置", () => bridge.remove(id), () => { setRemoveConfirmation(""); setSelectedId(""); setNewId(crypto.randomUUID()); })}>确认移除</Button><Button variant="outline" disabled={disabled} onClick={() => setRemoveConfirmation("")}>取消</Button></div></div>}
        </SettingsSectionCard>
      </>}
      {errors[id] && <p role="alert" className="git-sync-error rounded-lg border p-3 text-sm">{errors[id]}</p>}
    </>}
    <SettingsSectionCard title="连接说明"><ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground"><li>需要本机安装 Git，并将 SSH 公钥添加到 GitHub 或 Gitee。</li><li>首次连接平台请先在终端完成 SSH 主机信任确认；加密私钥需要由 SSH agent 解锁。</li><li>成功同步不会弹出通知，异常可在同步状态中查看并重试。</li></ul></SettingsSectionCard>
  </div>;
}
