import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { cn } from "../../src/lib/utils";

// Run independently: keep the real panel state/handlers, stub remote services
// and UI primitives so delayed responses are deterministic without a browser.
const { window: host, document: doc } = parseHTML("<html><body></body></html>");
const handlers = new Map<string, () => unknown>();
const textOf = (node: any): string => typeof node === "string" ? node : Array.isArray(node) ? node.map(textOf).join("") : node?.props ? textOf(node.props.children) : "";
const Button = ({ children, onClick, disabled }: any) => {
  handlers.set(textOf(children).trim(), onClick);
  return createElement("button", { onClick, disabled }, children);
};
const globals = {
  window: host, document: doc, HTMLElement: host.HTMLElement, Element: host.Element,
  IS_REACT_ACT_ENVIRONMENT: true, Button, cn,
  Label: ({ children }: any) => createElement("label", null, children),
  Switch: () => null,
  DialogShell: ({ open, title, children }: any) => open ? createElement("div", { role: "dialog", "aria-label": title }, children) : null,
};
const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const primitive = ({ children, title, actions }: { children?: ReactNode; title?: ReactNode; actions?: ReactNode }) => createElement("section", null, title, actions, children);
mock.module("@/components/ui/selectable-card", () => ({ SelectableCard: primitive }));
mock.module("@/pages/workspace/components/sidebar/settings/SettingsSectionCard", () => ({ SettingsSectionCard: primitive }));
mock.module("@/pages/workspace/components/sidebar/notebookUtils", () => ({ renderNotebookIcon: () => null }));
const settings = { webdavUrl: "https://backup.example", webdavUsername: "user", webdavPassword: "secret", webdavRemoteDir: "backups", webdavRetentionDays: 30, webdavAutoBackupEnabled: false, updateWebdavSettings: () => {} };
mock.module("@/stores/settings", () => ({ useSettings: () => settings }));
mock.module("@/stores/useNotebooks", () => ({ useNotebooks: () => ({ notebooks: {} }) }));
mock.module("@/stores/usePages", () => ({ usePages: () => ({ pages: {} }) }));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const backup = (basename = "backup.zip") => ({ basename, filename: basename, size: 100, lastmod: "2026-09-30" });
let lists: Array<ReturnType<typeof deferred<any[]>>> = [];
let download = deferred<Blob>();
let zip = deferred<Blob>();
const calls: string[] = [];
mock.module("@/lib/export", () => ({ generateExportZip: () => { calls.push("export"); return zip.promise; } }));
mock.module("@/lib/webdavSync", () => ({
  listWebdavBackups: () => { calls.push("list"); return lists.shift()!.promise; },
  downloadWebdavBackup: () => { calls.push("download"); return download.promise; },
  deleteWebdavBackup: async () => { calls.push("delete"); },
  uploadWebdavBackup: async () => { calls.push("upload"); return { success: true, cleanedCount: 0 }; },
  testWebdavConnection: async () => ({ ok: true }), normalizeBaseUrl: (value: string) => value, normalizeRemoteDir: (value: string) => value,
}));
mock.module("@/components/ui/sonner", () => ({ toast: { error: () => calls.push("error"), success: () => calls.push("success") } }));
const { SettingsDataPanel } = await import("../../src/pages/workspace/components/sidebar/settings/SettingsDataPanel");
let root: Root | null = null;
const props = { importing: false, onImport: () => {}, selectedIds: [], notebookList: [{ id: "notebook", name: "Notebook" }], onToggleNotebook: () => {}, onSelectAll: () => {}, format: "md" as const, onFormatChange: () => {}, exporting: false, onExport: () => {}, onOpenResetDialog: () => {}, onRestartGuide: () => {}, onResetAndImport: async () => { calls.push("import"); } };
function render(active: boolean) {
  if (!root) { const container = doc.createElement("div"); doc.body.append(container); root = createRoot(container); }
  act(() => root!.render(createElement(SettingsDataPanel, { ...props, active })));
}
function start(label: string) {
  let pending: unknown;
  act(() => { pending = handlers.get(label)!(); });
  return pending as Promise<void>;
}
async function settle<T>(item: ReturnType<typeof deferred<T>>, value: T, pending: Promise<void>) {
  await act(async () => { item.resolve(value); await pending; });
}
function syncButton() { return [...doc.querySelectorAll("button")].find(node => node.textContent?.trim() === "同步最新配置")!; }
beforeEach(() => { calls.length = 0; lists = []; handlers.clear(); download = deferred(); zip = deferred(); doc.body.innerHTML = ""; });
afterEach(() => { act(() => root?.unmount()); root = null; });
afterAll(() => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

describe("SettingsDataPanel activation boundary", () => {
  test("closing removes visible confirmation and syncing state; reopening keeps configuration fields mounted", async () => {
    render(true);
    const password = doc.querySelector<HTMLInputElement>('input[type="password"]')!;
    const list = deferred<any[]>(); lists.push(list); const pending = start("同步最新配置");
    await settle(list, [backup()], pending);
    expect(doc.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe("同步最新备份");
    expect(syncButton().hasAttribute("disabled")).toBe(true);
    render(false); expect(doc.querySelector('[role="dialog"]')).toBeNull();
    render(true); expect(doc.querySelector('[role="dialog"]')).toBeNull(); expect(syncButton().hasAttribute("disabled")).toBe(false);
    expect(doc.querySelector('input[type="password"]')).toBe(password);
    expect(calls).toEqual(["list"]);
  });
  test("delayed list after closing cannot show a dialog or start another hidden request", async () => {
    render(true); const request = deferred<any[]>(); lists.push(request);
    const pending = start("同步最新配置"), oldStart = handlers.get("同步最新配置")!;
    render(false); await settle(request, [backup()], pending);
    await act(async () => { await oldStart(); });
    expect(doc.querySelector('[role="dialog"]')).toBeNull(); expect(calls).toEqual(["list"]);
    render(true); expect(doc.querySelector('[role="dialog"]')).toBeNull(); expect(syncButton().hasAttribute("disabled")).toBe(false);
  });
  test("close/reopen invalidates old list even when a newer request is pending", async () => {
    render(true); const old = deferred<any[]>(); lists.push(old); const oldPending = start("同步最新配置");
    render(false); render(true);
    const current = deferred<any[]>(); lists.push(current); const currentPending = start("同步最新配置");
    await settle(old, [backup("old.zip")], oldPending);
    expect(doc.querySelector('[role="dialog"]')).toBeNull(); expect(syncButton().hasAttribute("disabled")).toBe(true);
    await settle(current, [backup("current.zip")], currentPending);
    expect(doc.querySelector('[role="dialog"]')?.textContent).toContain("current.zip");
    expect(doc.querySelector('[role="dialog"]')?.textContent).not.toContain("old.zip");
  });
  test("late error from previous activation cannot clear a new request's syncing state", async () => {
    render(true); const old = deferred<any[]>(); lists.push(old); const oldPending = start("同步最新配置");
    render(false); render(true); const current = deferred<any[]>(); lists.push(current); const currentPending = start("同步最新配置");
    await act(async () => { old.reject(new Error("stale failure")); await oldPending; });
    expect(syncButton().hasAttribute("disabled")).toBe(true); expect(calls).not.toContain("error");
    await settle(current, [], currentPending); expect(syncButton().hasAttribute("disabled")).toBe(false);
  });
  test("a stale confirmation cannot download while hidden or after reopening", async () => {
    render(true); const request = deferred<any[]>(); lists.push(request); const pending = start("同步最新配置");
    await settle(request, [backup()], pending); const confirm = handlers.get("确定")!;
    render(false); await act(async () => { await confirm(); });
    render(true); await act(async () => { await confirm(); });
    expect(calls).toEqual(["list"]); expect(doc.querySelector('[role="dialog"]')).toBeNull();
  });
  test("a current visible confirmation still downloads and restores its backup", async () => {
    render(true); const request = deferred<any[]>(); lists.push(request); const pending = start("同步最新配置");
    await settle(request, [backup()], pending);
    const confirming = start("确定");
    await settle(download, new Blob(["backup"]), confirming);
    expect(calls).toEqual(["list", "download", "import"]);
    expect(doc.querySelector('[role="dialog"]')).toBeNull(); expect(syncButton().hasAttribute("disabled")).toBe(false);
  });
  test("download finishing after close/reopen cannot start destructive local restoration", async () => {
    render(true); const request = deferred<any[]>(); lists.push(request); const pending = start("同步最新配置");
    await settle(request, [backup()], pending); const confirming = start("确定");
    expect(calls).toContain("download"); render(false); render(true);
    await settle(download, new Blob(["backup"]), confirming);
    expect(calls).not.toContain("import"); expect(syncButton().hasAttribute("disabled")).toBe(false);
  });
  test("export finishing after close/reopen cannot start upload with remote retention deletion", async () => {
    render(true); const uploading = start("生成并上传");
    expect(calls).toEqual(["export"]); render(false); render(true);
    await settle(zip, new Blob(["backup"]), uploading); expect(calls).toEqual(["export"]);
  });
  test("remote restore and delete confirmations cannot execute after deactivation", async () => {
    render(true); const request = deferred<any[]>(); lists.push(request); const pending = start("同步最新配置");
    await settle(request, [backup()], pending); start("取消");
    const list = deferred<any[]>(); lists.push(list);
    const toggle = [...doc.querySelectorAll("button")].find(node => node.textContent?.trim() === "远端备份")!;
    act(() => toggle.click());
    await settle(list, [backup()], list.promise.then(() => {}));
    start("删除"); const deleteConfirm = handlers.get("确定")!;
    render(false); render(true); await act(async () => { await deleteConfirm(); }); expect(calls).not.toContain("delete");
    start("恢复"); const restoreConfirm = handlers.get("确定")!;
    render(false); await act(async () => { await restoreConfirm(); }); expect(calls).not.toContain("download");
  });
});
