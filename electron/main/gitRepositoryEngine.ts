import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateGitRepository, type GitRepositoryInput, type GitRepositoryFolder } from "../../src/lib/git-sync-contract";
import { gitBytes } from "./gitSyncEngine";
import { durableAtomicWrite } from "./gitSyncDisk";

type Files = Record<string, string>; // base64 bytes; snapshots are also recovery backups.
type Snapshots = Record<string, Files>;
interface Journal { commit: string; before: Snapshots; after: Snapshots }
interface Manifest { version: 1; identity: string; baseline: Snapshots; pending?: Journal }
const excluded = new Set([".git", ".ds_store", "thumbs.db", "desktop.ini", ".cache", "node_modules", ".goose-cache"]);
const git = async (root: string, args: string[]) => (await gitBytes(root, args)).toString("utf8").trim();
const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const empty = (): Files => Object.create(null) as Files;
const safeParts = (name: string) => name.split("/").every((part) => part && part !== "." && part !== ".." && !/[\\\0\r\n:]/.test(part) && !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
const ignored = (name: string) => name.split("/").some((part) => excluded.has(part.toLowerCase()) || part.startsWith(".goose-sync-"));
const mappingKey = (folder: GitRepositoryFolder) => `${folder.notebookId}:${folder.remotePath}`;
const remoteName = (folder: GitRepositoryFolder, name: string) => folder.remotePath ? `${folder.remotePath}/${name}` : name;

async function atomicJson(file: string, value: unknown) {
  await durableAtomicWrite(file, JSON.stringify(value));
}

async function assertRoot(root: string) {
  const stat = await lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(root) !== root) throw new Error("同步文件夹已移动、缺失或包含符号链接，已停止同步");
}

async function scan(root: string): Promise<Files> {
  await assertRoot(root);
  const files = empty();
  const names = new Set<string>();
  async function walk(relative: string) {
    const directory = path.join(root, relative);
    if (await realpath(directory) !== directory || (await lstat(directory)).isSymbolicLink()) throw new Error("文件夹包含符号链接，已停止同步");
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (ignored(name)) continue;
      if (!safeParts(name) || entry.isSymbolicLink()) throw new Error("文件夹包含不安全的文件名或符号链接，已停止同步");
      const folded = name.normalize("NFC").toLowerCase();
      if (names.has(folded)) throw new Error("文件夹包含大小写冲突的路径，已停止同步");
      names.add(folded);
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) {
        const target = path.join(root, name);
        if (await realpath(target) !== target) throw new Error("文件夹包含符号链接，已停止同步");
        const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
        try { files[name] = (await handle.readFile()).toString("base64"); }
        finally { await handle.close(); }
      }
      else throw new Error("文件夹包含不支持的特殊文件，已停止同步");
    }
  }
  await walk("");
  return files;
}

function assertTree(files: Files) {
  const seen = new Set<string>();
  const directories = new Set<string>();
  for (const name of Object.keys(files)) {
    if (!safeParts(name) || ignored(name)) throw new Error("远端包含不安全的同步路径");
    const folded = name.normalize("NFC").toLowerCase();
    if (seen.has(folded) || directories.has(folded)) throw new Error("同步文件存在大小写或文件/目录冲突，双方内容已保留");
    const parts = folded.split("/");
    parts.pop();
    while (parts.length) {
      const parent = parts.join("/");
      if (seen.has(parent)) throw new Error("同步文件存在文件/目录冲突，双方内容已保留");
      directories.add(parent); parts.pop();
    }
    seen.add(folded);
  }
}

/** A missing baseline means first attach: absence locally must not delete remote files. */
export function reconcileGitFiles(base: Files | undefined, local: Files, remote: Files): Files {
  const merged = empty();
  for (const name of new Set([...Object.keys(base ?? {}), ...Object.keys(local), ...Object.keys(remote)])) {
    const b = base?.[name], l = local[name], r = remote[name];
    let value: string | undefined;
    if (l === r) value = l;
    else if (!base || !own(base, name)) {
      if (l !== undefined && r !== undefined) throw new Error("同步冲突：同一文件的本地与远端内容不同；双方内容已保留，请先处理后重试");
      value = l ?? r;
    } else if (l === b) value = r;
    else if (r === b) value = l;
    else throw new Error("同步冲突：同一文件被双方修改或删除；双方内容已保留，请先处理后重试");
    if (value !== undefined) merged[name] = value;
  }
  assertTree(merged);
  return merged;
}

async function safeTarget(root: string, name: string) {
  if (!safeParts(name) || ignored(name)) throw new Error("同步路径无效");
  await assertRoot(root);
  let target = root;
  const parts = name.split("/");
  for (const [index, part] of parts.entries()) {
    target = path.join(target, part);
    const stat = await lstat(target).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error; });
    if (stat && (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()))) throw new Error("同步目标出现符号链接或文件/目录冲突，已保留恢复备份");
  }
  return target;
}

async function applyJournal(config: GitRepositoryInput, journal: Journal, verifyRoot?: (root: string) => Promise<void>) {
  // Preflight every selected folder before changing any of them. A partially applied journal
  // accepts either the original or target bytes, so retries cannot turn remote edits into deletes.
  for (const folder of config.folders) {
    await verifyRoot?.(folder.localPath);
    const key = mappingKey(folder), before = journal.before[key] ?? empty(), after = journal.after[key] ?? empty();
    const current = await scan(folder.localPath);
    for (const name of new Set([...Object.keys(before), ...Object.keys(after), ...Object.keys(current)])) {
      if (current[name] !== before[name] && current[name] !== after[name]) throw new Error("上次同步尚未应用完成，本地文件又有修改；恢复备份已保留，请处理后重试");
      await safeTarget(folder.localPath, name);
    }
  }
  for (const folder of config.folders) {
    const key = mappingKey(folder), before = journal.before[key] ?? empty(), after = journal.after[key] ?? empty();
    for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
      await verifyRoot?.(folder.localPath);
      const target = await safeTarget(folder.localPath, name);
      const current = await readFile(target).then((value) => value.toString("base64")).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return undefined; throw error; });
      if (current === after[name]) continue;
      if (current !== before[name]) throw new Error("应用同步时文件发生变化；恢复备份已保留");
      if (after[name] === undefined) {
        await rm(target);
        if (process.platform !== "win32") {
          const directory = await open(path.dirname(target), "r");
          try { await directory.sync(); } finally { await directory.close(); }
        }
      }
      else {
        await mkdir(path.dirname(target), { recursive: true });
        await safeTarget(folder.localPath, name);
        await durableAtomicWrite(target, Buffer.from(after[name]!, "base64"));
      }
    }
  }
}

export interface GitRepositorySyncOptions {
  storageRoot: string;
  verifyRoot?: (root: string) => Promise<void>;
  /** Fault injection for isolated recovery tests; production does not set this. */
  afterPush?: () => Promise<void>;
}

/** Isolated Git objects/index: remote trees are never checked out into notebook roots. */
export async function syncGitRepository(input: GitRepositoryInput, options: GitRepositorySyncOptions): Promise<void> {
  const config = validateGitRepository(input);
  if (!config.folders.length) return;
  const root = path.join(options.storageRoot, config.id);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await assertRoot(root);
  const work = path.join(root, "worktree");
  await mkdir(work, { recursive: true, mode: 0o700 });
  await assertRoot(work);
  const gitDir = path.join(work, ".git");
  const gitStat = await lstat(gitDir).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error; });
  if (gitStat && (!gitStat.isDirectory() || gitStat.isSymbolicLink())) throw new Error("隔离同步仓库路径无效");
  if (!gitStat) await git(work, ["init", "--initial-branch", config.branch]);
  // All transport uses an explicit validated URL; never honor local rewrite rules.
  const rewrites = await git(work, ["config", "--local", "--includes", "--get-regexp", "^(url\\.|include\\.|includeif\\.)"]).catch(() => "");
  if (rewrites) throw new Error("隔离仓库包含地址改写规则，已停止同步");
  const identity = createHash("sha256").update(`${config.provider}\0${config.remoteUrl}\0${config.branch}\0${config.layout}`).digest("hex");
  const manifestFile = path.join(root, "manifest.json");
  let manifest: Manifest;
  try { manifest = JSON.parse(await readFile(manifestFile, "utf8"), (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.assign(Object.create(null), value) : value); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw Object.assign(new Error("同步恢复记录无法读取，已停止同步"), { cause: error }); manifest = { version: 1, identity, baseline: {} }; }
  if (manifest.version !== 1 || manifest.identity !== identity) throw new Error("仓库身份已变化，请新建同步配置");
  const local: Snapshots = {};
  for (const folder of config.folders) {
    await options.verifyRoot?.(folder.localPath);
    local[mappingKey(folder)] = await scan(folder.localPath);
  }
  const ref = `refs/heads/${config.branch}`;
  await atomicJson(path.join(root, "local-recovery.json"), local);
  const remoteExists = Boolean(await git(work, ["ls-remote", "--heads", config.remoteUrl, ref]));
  let remoteHead: string | undefined;
  if (remoteExists) {
    await git(work, ["fetch", "--no-tags", "--no-recurse-submodules", config.remoteUrl, ref]);
    remoteHead = await git(work, ["rev-parse", "FETCH_HEAD"]);
  }
  if (manifest.pending) {
    const selectedKeys = new Set(config.folders.map(mappingKey));
    if (Object.keys(manifest.pending.after).some((key) => !selectedKeys.has(key))) throw new Error("上次同步仍有待恢复文件夹，请重新勾选原文件夹并完成同步后再取消选择");
    const pushed = remoteHead && await git(work, ["merge-base", "--is-ancestor", manifest.pending.commit, remoteHead]).then(() => true).catch(() => false);
    if (pushed) {
      await applyJournal(config, manifest.pending, options.verifyRoot);
      manifest.baseline = { ...manifest.baseline, ...manifest.pending.after };
      delete manifest.pending;
      await atomicJson(manifestFile, manifest);
      for (const folder of config.folders) local[mappingKey(folder)] = await scan(folder.localPath);
    } else {
      // A rejected push never applied files. Preserve its backup, then recompute against
      // the current remote and last successful baseline instead of replaying stale output.
      await atomicJson(path.join(root, `recovery-${manifest.pending.commit}.json`), manifest.pending);
      delete manifest.pending;
      await atomicJson(manifestFile, manifest);
    }
  }
  const remote: Snapshots = {};
  for (const folder of config.folders) remote[mappingKey(folder)] = empty();
  if (remoteHead) {
    const entries = (await gitBytes(work, ["ls-tree", "-r", "-z", remoteHead])).toString("utf8").split("\0").filter(Boolean);
    for (const entry of entries) {
      const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(entry);
      if (!match) throw new Error("远端 Git 文件树无效");
      const mode = match[1]!, type = match[2]!, oid = match[3]!, name = match[4]!;
      for (const folder of config.folders) {
        if (folder.remotePath && name !== folder.remotePath && !name.startsWith(`${folder.remotePath}/`)) {
          const folded = name.normalize("NFC").toLowerCase(), prefix = folder.remotePath.toLowerCase();
          if (folded === prefix || folded.startsWith(`${prefix}/`)) throw new Error("远端目录名称存在大小写冲突，已停止同步");
          continue;
        }
        const relative = folder.remotePath ? name.slice(folder.remotePath.length + 1) : name;
        if (ignored(relative)) continue;
        if (!relative || !safeParts(relative) || type !== "blob" || !["100644", "100755"].includes(mode)) throw new Error("远端所选目录包含符号链接、子模块或不安全路径，已停止同步");
        remote[mappingKey(folder)]![relative] = (await gitBytes(work, ["cat-file", "blob", oid])).toString("base64");
      }
    }
  }
  const after: Snapshots = {};
  for (const folder of config.folders) {
    const key = mappingKey(folder);
    assertTree(remote[key]!);
    after[key] = reconcileGitFiles(manifest.baseline[key], local[key]!, remote[key]!);
    // Catch file/directory collisions and unsafe ancestors before creating/pushing a commit.
    for (const name of new Set([...Object.keys(local[key]!), ...Object.keys(after[key]!)])) await safeTarget(folder.localPath, name);
  }
  await git(work, remoteHead ? ["read-tree", remoteHead] : ["read-tree", "--empty"]);
  const blobFile = path.join(root, "blob");
  for (const folder of config.folders) {
    const key = mappingKey(folder);
    for (const name of new Set([...Object.keys(remote[key]!), ...Object.keys(after[key]!)])) {
      if (after[key]![name] === remote[key]![name]) continue;
      const destination = remoteName(folder, name);
      if (after[key]![name] === undefined) await git(work, ["update-index", "--force-remove", "--", destination]);
      else {
        await writeFile(blobFile, Buffer.from(after[key]![name]!, "base64"), { mode: 0o600 });
        const oid = await git(work, ["hash-object", "-w", "--no-filters", "--", blobFile]);
        await git(work, ["update-index", "--add", "--cacheinfo", "100644", oid, destination]);
      }
    }
  }
  await rm(blobFile, { force: true });
  const tree = await git(work, ["write-tree"]);
  const unchanged = remoteHead && await git(work, ["rev-parse", `${remoteHead}^{tree}`]) === tree;
  const commit = unchanged ? remoteHead! : await git(work, ["commit-tree", tree, ...(remoteHead ? ["-p", remoteHead] : []), "-m", "同步笔记"]);
  await git(work, ["update-ref", "refs/heads/goose-local", commit]);
  manifest.pending = { commit, before: local, after };
  await atomicJson(manifestFile, manifest);
  if (!unchanged) {
    try { await git(work, ["push", "--no-verify", config.remoteUrl, `${commit}:${ref}`]); }
    catch { throw new Error("推送失败，本地内容与恢复备份已保留；请检查 SSH 权限、网络或远端更新后重试"); }
  }
  await options.afterPush?.();
  await applyJournal(config, manifest.pending, options.verifyRoot);
  manifest.baseline = { ...manifest.baseline, ...after };
  delete manifest.pending;
  await atomicJson(manifestFile, manifest);
}
