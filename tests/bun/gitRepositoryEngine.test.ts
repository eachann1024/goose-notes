import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { syncGitRepository } from "../../electron/main/gitRepositoryEngine";
import { validateGitRepository, type GitRepositoryInput } from "../../src/lib/git-sync-contract";
import { GitSyncSerialQueue, migrateGitSyncState } from "../../electron/main/gitSyncStore";
import { checkGitVisibility, parseGitVisibility } from "../../electron/main/gitSyncVisibility";
import { GitSyncPreparation } from "../../src/lib/git-sync-preparation";

const exec = promisify(execFile);
const git = async (cwd: string, ...args: string[]) => (await exec("git", ["-c", "user.name=Test", "-c", "user.email=test@localhost", ...args], { cwd })).stdout.trim();
let temporary: string;
const originalPath = process.env.PATH;
beforeAll(async () => {
  temporary = await realpath(await mkdtemp(join(tmpdir(), "goose-repository-test-")));
  const bin = join(temporary, "bin"); await mkdir(bin);
  await writeFile(join(bin, "ssh"), `#!/bin/sh\nfor arg do last="$arg"; done\ncase "$last" in\n git-upload-pack*) exec git-upload-pack "$GOOSE_REPOSITORY_REMOTE" ;;\n git-receive-pack*) if [ "$GOOSE_REPOSITORY_REJECT" = "1" ]; then exit 1; fi; exec git-receive-pack "$GOOSE_REPOSITORY_REMOTE" ;;\n *) exit 2 ;;\nesac\n`);
  await chmod(join(bin, "ssh"), 0o755); process.env.PATH = `${bin}:${originalPath}`;
});
afterAll(async () => { process.env.PATH = originalPath; delete process.env.GOOSE_REPOSITORY_REMOTE; delete process.env.GOOSE_REPOSITORY_REJECT; await rm(temporary, { recursive: true, force: true }); });
async function fixture(name: string) {
  const base = join(temporary, name); await mkdir(base);
  const remote = join(base, "remote.git"); await git(base, "init", "--bare", "--initial-branch=main", remote);
  process.env.GOOSE_REPOSITORY_REMOTE = remote;
  const a = join(base, "a"), b = join(base, "b"), other = join(base, "other");
  await Promise.all([a, b, other].map((p) => mkdir(p)));
  const config: GitRepositoryInput = { id: "repo", provider: "github", remoteUrl: "git@github.com:owner/repo.git", branch: "main", enabled: false, intervalMinutes: 5, layout: "subfolders", folders: [{ notebookId: "a", localPath: a, name: "A", remotePath: "folder-a" }, { notebookId: "b", localPath: b, name: "B", remotePath: "folder-b" }] };
  const options = { storageRoot: join(base, "storage") };
  const peer = { ...config, id: "peer", folders: [{ ...config.folders[0]!, localPath: other }] };
  return { a, b, other, remote, config, peer, options, base };
}

describe("isolated repository sync", () => {
  test("two folders map independently; first attach preserves selected and unselected remote files", async () => {
    const f = await fixture("two-folders");
    await writeFile(join(f.other, "constructor"), "ordinary filename\n");
    await writeFile(join(f.other, "remote.md"), "remote\n"); await syncGitRepository(f.peer, f.options);
    await writeFile(join(f.a, "same.md"), "a\n"); await writeFile(join(f.b, "same.md"), "b\n");
    await syncGitRepository(f.config, f.options);
    expect(await git(f.remote, "show", "main:folder-a/same.md")).toBe("a");
    expect(await git(f.remote, "show", "main:folder-b/same.md")).toBe("b");
    expect(await readFile(join(f.a, "remote.md"), "utf8")).toBe("remote\n");
    await writeFile(join(f.other, "new.md"), "peer\n"); await syncGitRepository(f.peer, f.options);
    expect(await git(f.remote, "show", "main:folder-b/same.md")).toBe("b");
    expect(await Bun.file(join(f.a, ".git")).exists()).toBe(false);
    await syncGitRepository(f.config, f.options); await syncGitRepository(f.config, f.options);
    expect(await readFile(join(f.a, "new.md"), "utf8")).toBe("peer\n");
    expect(await readFile(join(f.a, "constructor"), "utf8")).toBe("ordinary filename\n");
  }, 30000);
  test("local and remote deletions and renames persist without resurrection", async () => {
    const f = await fixture("deletion"); await writeFile(join(f.a, "old.md"), "base");
    await syncGitRepository(f.config, f.options); await syncGitRepository(f.peer, f.options);
    await rm(join(f.other, "old.md")); await writeFile(join(f.other, "renamed.md"), "base"); await syncGitRepository(f.peer, f.options);
    await syncGitRepository(f.config, f.options); await syncGitRepository(f.config, f.options);
    expect(await Bun.file(join(f.a, "old.md")).exists()).toBe(false);
    await rm(join(f.a, "renamed.md")); await syncGitRepository(f.config, f.options); await syncGitRepository(f.peer, f.options);
    expect(await Bun.file(join(f.other, "renamed.md")).exists()).toBe(false);
  }, 30000);
  test("different-file edits merge, same-file and modify/delete conflicts preserve both sides", async () => {
    const f = await fixture("conflict"); await writeFile(join(f.a, "note.md"), "base"); await syncGitRepository(f.config, f.options); await syncGitRepository(f.peer, f.options);
    await writeFile(join(f.other, "note.md"), "remote"); await syncGitRepository(f.peer, f.options);
    await writeFile(join(f.a, "note.md"), "local");
    await expect(syncGitRepository(f.config, f.options)).rejects.toThrow("冲突");
    expect(await readFile(join(f.a, "note.md"), "utf8")).toBe("local"); expect(await git(f.remote, "show", "main:folder-a/note.md")).toBe("remote");
    await rm(join(f.a, "note.md")); await expect(syncGitRepository(f.config, f.options)).rejects.toThrow("冲突");
    await writeFile(join(f.a, "note.md"), "remote"); await syncGitRepository(f.config, f.options);
    await writeFile(join(f.a, "local.md"), "local"); await writeFile(join(f.other, "peer.md"), "peer"); await syncGitRepository(f.peer, f.options); await syncGitRepository(f.config, f.options);
    expect(await readFile(join(f.a, "peer.md"), "utf8")).toBe("peer");
  }, 30000);
  test("failed push retries, crash after push recovers before incorporating new remote changes", async () => {
    const f = await fixture("retry"); await writeFile(join(f.a, "note.md"), "local");
    process.env.GOOSE_REPOSITORY_REJECT = "1";
    try { await expect(syncGitRepository(f.config, f.options)).rejects.toThrow("推送失败"); } finally { delete process.env.GOOSE_REPOSITORY_REJECT; }
    await syncGitRepository(f.config, f.options); await syncGitRepository(f.peer, f.options);
    await writeFile(join(f.other, "peer.md"), "remote"); await syncGitRepository(f.peer, f.options);
    await expect(syncGitRepository(f.config, { ...f.options, afterPush: async () => { throw new Error("crash"); } })).rejects.toThrow("crash");
    expect(await Bun.file(join(f.a, "peer.md")).exists()).toBe(false);
    const manifest = JSON.parse(await readFile(join(f.options.storageRoot, "repo", "manifest.json"), "utf8"));
    expect(manifest.pending).toBeDefined(); expect(manifest.baseline["a:folder-a"]["peer.md"]).toBeUndefined();
    await writeFile(join(f.other, "peer.md"), "newer remote"); await syncGitRepository(f.peer, f.options);
    await syncGitRepository(f.config, f.options); await syncGitRepository(f.config, f.options);
    expect(await readFile(join(f.a, "peer.md"), "utf8")).toBe("newer remote");
  }, 30000);
  test("partial local apply retries with durable original/target bytes", async () => {
    const f = await fixture("partial"); await writeFile(join(f.other, "one.md"), "1"); await writeFile(join(f.other, "two.md"), "2"); await syncGitRepository(f.peer, f.options);
    let applying = false, count = 0;
    await expect(syncGitRepository(f.config, { ...f.options, afterPush: async () => { applying = true; }, verifyRoot: async () => { if (applying && ++count === 4) throw new Error("apply failed"); } })).rejects.toThrow("apply failed");
    await syncGitRepository(f.config, f.options);
    expect(await readFile(join(f.a, "one.md"), "utf8")).toBe("1"); expect(await readFile(join(f.a, "two.md"), "utf8")).toBe("2");
  }, 30000);
  test("missing roots never mass-delete; nested git/cache excluded; symlinks and remote symlinks rejected", async () => {
    const f = await fixture("safety"); await writeFile(join(f.a, "note.md"), "keep");
    await mkdir(join(f.a, "nested", ".git"), { recursive: true }); await writeFile(join(f.a, "nested", ".git", "config"), "secret");
    await mkdir(join(f.a, ".cache")); await writeFile(join(f.a, ".cache", "cache"), "cache"); await syncGitRepository(f.config, f.options);
    expect(await git(f.remote, "ls-tree", "-r", "--name-only", "main")).toBe("folder-a/note.md");
    await symlink(f.b, join(f.a, "unsafe")); await expect(syncGitRepository(f.config, f.options)).rejects.toThrow("符号链接"); await rm(join(f.a, "unsafe"));
    await rm(f.b, { recursive: true }); await expect(syncGitRepository(f.config, f.options)).rejects.toThrow();
    expect(await git(f.remote, "show", "main:folder-a/note.md")).toBe("keep");
    await mkdir(f.b);
    const clone = join(f.base, "clone"); await git(f.base, "clone", f.remote, clone); await symlink("/tmp", join(clone, "folder-a", "link")); await git(clone, "add", "."); await git(clone, "commit", "-m", "link"); await git(clone, "push");
    await expect(syncGitRepository(f.config, f.options)).rejects.toThrow("符号链接");
    expect(await Bun.file(join(f.a, "link")).exists()).toBe(false);
  }, 30000);
  test("unchecking keeps remote files and rechecking uses the prior baseline; equal edits/deletes succeed", async () => {
    const f = await fixture("recheck");
    await writeFile(join(f.a, "note.md"), "base"); await writeFile(join(f.b, "keep.md"), "keep");
    await syncGitRepository(f.config, f.options); await syncGitRepository(f.peer, f.options);
    await syncGitRepository({ ...f.config, folders: [f.config.folders[0]!] }, f.options);
    expect(await git(f.remote, "show", "main:folder-b/keep.md")).toBe("keep");
    await writeFile(join(f.a, "note.md"), "same edit"); await writeFile(join(f.other, "note.md"), "same edit");
    await syncGitRepository(f.peer, f.options); await syncGitRepository(f.config, f.options);
    await rm(join(f.a, "note.md")); await rm(join(f.other, "note.md"));
    await syncGitRepository(f.peer, f.options); await syncGitRepository(f.config, f.options);
    expect(await Bun.file(join(f.a, "note.md")).exists()).toBe(false);
    expect(await readFile(join(f.b, "keep.md"), "utf8")).toBe("keep");
  }, 30000);
  test("first attach conflicts and file/directory collisions retain both versions", async () => {
    const f = await fixture("attach-conflict");
    await writeFile(join(f.other, "same.md"), "remote"); await syncGitRepository(f.peer, f.options);
    await writeFile(join(f.a, "same.md"), "local"); await expect(syncGitRepository(f.config, f.options)).rejects.toThrow("冲突");
    expect(await git(f.remote, "show", "main:folder-a/same.md")).toBe("remote");
    const backup = JSON.parse(await readFile(join(f.options.storageRoot, "repo", "local-recovery.json"), "utf8"));
    expect(Buffer.from(backup["a:folder-a"]["same.md"], "base64").toString()).toBe("local");
    await rm(join(f.a, "same.md")); await mkdir(join(f.a, "same.md")); await writeFile(join(f.a, "same.md", "child.md"), "child");
    await expect(syncGitRepository(f.config, f.options)).rejects.toThrow("冲突");
    expect(await readFile(join(f.a, "same.md", "child.md"), "utf8")).toBe("child");
  }, 30000);
  test("separate repositories can select the same folder and preserve remote isolation", async () => {
    const f = await fixture("multiple"); await writeFile(join(f.a, "shared.md"), "shared"); await syncGitRepository(f.config, f.options);
    const secondRemote = join(f.base, "second.git"); await git(f.base, "init", "--bare", "--initial-branch=main", secondRemote);
    process.env.GOOSE_REPOSITORY_REMOTE = secondRemote;
    const second = { ...f.config, id: "second", remoteUrl: "git@gitee.com:owner/second.git", provider: "gitee" as const, folders: [f.config.folders[0]!] };
    await syncGitRepository(second, f.options);
    expect(await git(secondRemote, "show", "main:folder-a/shared.md")).toBe("shared");
    expect(await git(f.remote, "show", "main:folder-a/shared.md")).toBe("shared");
    expect(await Bun.file(join(f.options.storageRoot, "repo", "manifest.json")).exists()).toBe(true);
    expect(await Bun.file(join(f.options.storageRoot, "second", "manifest.json")).exists()).toBe(true);
  }, 30000);
});

describe("repository contract and lifecycle", () => {
  test("mapping validation and legacy migration keep root layout and disable duplicate remotes", async () => {
    const f = await fixture("validation");
    for (const remotePath of ["../escape", ".git", "a/b", "a\\b", "/absolute"]) expect(() => validateGitRepository({ ...f.config, folders: [{ ...f.config.folders[0]!, remotePath }] })).toThrow();
    expect(() => validateGitRepository({ ...f.config, id: "../escape" })).toThrow();
    expect(() => validateGitRepository({ ...f.config, folders: [f.config.folders[0]!, { ...f.config.folders[1]!, localPath: join(f.a, "child") }] })).toThrow("重叠");
    const legacy = { notebookId: "a", localPath: f.a, provider: "github", remoteUrl: f.config.remoteUrl, branch: "main", enabled: true, intervalMinutes: 5 };
    const migrated = migrateGitSyncState({ configs: [legacy, { ...legacy, notebookId: "b", localPath: f.b, remoteUrl: "ssh://git@github.com/OWNER/repo" }], statuses: [] });
    expect(migrated.configs.every((config) => config.layout === "legacy-root" && !config.enabled && config.folders[0]!.remotePath === "")).toBe(true);
    expect(migrated.statuses.every((status) => status.phase === "error")).toBe(true);
    await writeFile(join(f.a, "root.md"), "root"); await syncGitRepository(migrated.configs[0]!, f.options);
    expect(await git(f.remote, "show", "main:root.md")).toBe("root");
  }, 30000);
  test("serialized mutations and sync requests are never discarded after failure", async () => {
    const queue = new GitSyncSerialQueue(), events: string[] = []; let release!: () => void;
    const first = queue.run(async () => { events.push("first"); await new Promise<void>((resolve) => { release = resolve; }); throw new Error("fail"); });
    const second = queue.run(async () => { events.push("save+sync"); });
    const third = queue.run(async () => { events.push("manual"); });
    await Promise.resolve(); expect(events).toEqual(["first"]); release(); await expect(first).rejects.toThrow("fail"); await Promise.all([second, third]);
    expect(events).toEqual(["first", "save+sync", "manual"]);
  });
  test("prepare releases every root on failure, finish, late acquire and duplicate finish", async () => {
    const preparations = new GitSyncPreparation(), events: string[] = [];
    await expect(preparations.prepare("failure", async (request) => { request.addRelease(() => events.push("root1")); throw new Error("root2 failed"); })).rejects.toThrow();
    expect(events).toEqual(["root1"]);
    let resume!: () => void;
    const pending = preparations.prepare("late", async (request) => { request.addRelease(() => events.push("a")); await new Promise<void>((resolve) => { resume = resolve; }); request.addRelease(() => events.push("b")); });
    preparations.finish("late"); preparations.finish("late"); resume(); expect(await pending).toBe(false); expect(events).toEqual(["root1", "a", "b"]);
    expect(await preparations.prepare("late", async () => { throw new Error("must not run"); })).toBe(false);
    expect(await preparations.prepare("two", async (request) => { request.addRelease(() => events.push("first-root")); request.addRelease(() => events.push("second-root")); })).toBe(true);
    preparations.finish("two"); expect(events.slice(-2)).toEqual(["second-root", "first-root"]);
  });
  test("visibility accepts only boolean metadata; 404/auth/network always unknown and Gitee uses documented query auth", async () => {
    expect(parseGitVisibility({ private: false }).value).toBe("public"); expect(parseGitVisibility({ private: true }).value).toBe("private");
    for (const privateValue of [null, undefined, "false", "true", 0, 1]) expect(parseGitVisibility({ private: privateValue }).value).toBe("unknown");
    const f = await fixture("visibility");
    for (const status of [401, 403, 404, 429, 500]) expect((await checkGitVisibility(f.config, undefined, (async () => new Response("{}", { status })) as typeof fetch)).value).toBe("unknown");
    const response = await checkGitVisibility({ ...f.config, provider: "gitee", remoteUrl: "git@gitee.com:owner/repo.git" }, "test-secret", (async (url, options) => { expect(String(url)).toBe("https://gitee.com/api/v5/repos/owner/repo?access_token=test-secret"); expect(options?.redirect).toBe("error"); return Response.json({ private: true }); }) as typeof fetch);
    expect(response.value).toBe("private");
    const failed = await checkGitVisibility(f.config, "secret", (async () => { throw new Error("secret"); }) as unknown as typeof fetch);
    expect(failed.value).toBe("unknown"); expect(failed.reason).not.toContain("secret");
  });
});
