import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { syncGitNotebook } from "../../electron/main/gitSyncEngine";
import { validateGitSyncConfig } from "../../src/lib/git-sync-contract";

const exec = promisify(execFile);
const config = (localPath: string, remoteUrl = "git@github.com:owner/notebook.git") => ({ notebookId: "notebook", localPath, provider: "github" as const, remoteUrl, branch: "main", intervalMinutes: 5, enabled: true });
const git = async (cwd: string, ...args: string[]) => (await exec("git", ["-c", "user.name=Test", "-c", "user.email=test@localhost", ...args], { cwd })).stdout.trim();
let temporary: string;
const originalPath = process.env.PATH;

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), "goose-sync-test-"));
  const bin = join(temporary, "bin");
  await mkdir(bin);
  // Actual Git runs end-to-end; only SSH transport is mapped to disposable local bare repos.
  await writeFile(join(bin, "ssh"), `#!/bin/sh\nfor arg do last="$arg"; done\ncase "$last" in\n  git-upload-pack*) exec git-upload-pack "$GOOSE_TEST_REMOTE" ;;\n  git-receive-pack*) if [ "$GOOSE_TEST_REJECT_PUSH" = "1" ]; then exit 1; fi; exec git-receive-pack "$GOOSE_TEST_REMOTE" ;;\n  *) exit 2 ;;\nesac\n`);
  await chmod(join(bin, "ssh"), 0o755);
  process.env.PATH = `${bin}:${originalPath}`;
});
afterAll(async () => {
  process.env.PATH = originalPath;
  delete process.env.GOOSE_TEST_REMOTE;
  delete process.env.GOOSE_TEST_REJECT_PUSH;
  await rm(temporary, { recursive: true, force: true });
});

async function fixture(name: string) {
  const base = join(temporary, name);
  await mkdir(base);
  const remote = join(base, "remote.git");
  await git(base, "init", "--bare", "--initial-branch=main", remote);
  process.env.GOOSE_TEST_REMOTE = remote;
  const a = join(base, "a"), b = join(base, "b");
  await mkdir(a); await mkdir(b);
  return { a, b, remote };
}

describe("Git SSH sync", () => {
  test("rejects invalid transport, provider, branch and interval", () => {
    expect(() => validateGitSyncConfig(config("/tmp", "https://github.com/o/r"))).toThrow("SSH");
    expect(() => validateGitSyncConfig(config("/tmp", "git@gitee.com:o/r"))).toThrow("SSH");
    expect(() => validateGitSyncConfig({ ...config("/tmp"), branch: "../main" })).toThrow("分支");
    expect(() => validateGitSyncConfig({ ...config("/tmp"), intervalMinutes: 0 })).toThrow("间隔");
  });
  test("empty remote, initial clone, bidirectional changes and deletes", async () => {
    const { a, b, remote } = await fixture("roundtrip");
    await syncGitNotebook(config(a));
    await writeFile(join(a, "note.md"), "first\n");
    await syncGitNotebook(config(a));
    expect(await git(remote, "show", "main:note.md")).toBe("first");
    await syncGitNotebook(config(b));
    expect(await readFile(join(b, "note.md"), "utf8")).toBe("first\n");
    await writeFile(join(a, "a.md"), "from a\n");
    await writeFile(join(b, "b.md"), "from b\n");
    await syncGitNotebook(config(a));
    await syncGitNotebook(config(b));
    await syncGitNotebook(config(a));
    expect(await readFile(join(a, "b.md"), "utf8")).toBe("from b\n");
    await rm(join(b, "note.md"));
    await syncGitNotebook(config(b)); await syncGitNotebook(config(a));
    expect(await Bun.file(join(a, "note.md")).exists()).toBe(false);
  }, 30_000);
  test("initial unrelated local contents merge with existing README", async () => {
    const { a, b } = await fixture("initial");
    await writeFile(join(a, "README.md"), "remote readme\n"); await syncGitNotebook(config(a));
    await writeFile(join(b, "local.md"), "local note\n"); await syncGitNotebook(config(b));
    expect(await readFile(join(b, "README.md"), "utf8")).toBe("remote readme\n");
    expect(await readFile(join(b, "local.md"), "utf8")).toBe("local note\n");
  }, 30_000);
  test("conflict abort preserves both committed versions and leaves clean local files", async () => {
    const { a, b, remote } = await fixture("conflict");
    await writeFile(join(a, "note.md"), "base\n"); await syncGitNotebook(config(a)); await syncGitNotebook(config(b));
    await writeFile(join(a, "note.md"), "remote edit\n"); await syncGitNotebook(config(a));
    await writeFile(join(b, "note.md"), "local edit\n");
    await expect(syncGitNotebook(config(b))).rejects.toThrow("冲突");
    expect(await readFile(join(b, "note.md"), "utf8")).toBe("local edit\n");
    expect(await git(b, "show", "HEAD:note.md")).toBe("local edit");
    expect(await git(remote, "show", "main:note.md")).toBe("remote edit");
    expect(await git(b, "status", "--porcelain")).toBe("");
  }, 30_000);
  test("failed push retains commit and retries successfully", async () => {
    const { a, remote } = await fixture("retry");
    await writeFile(join(a, "note.md"), "keep me\n");
    process.env.GOOSE_TEST_REJECT_PUSH = "1";
    try { await expect(syncGitNotebook(config(a))).rejects.toThrow("推送失败"); }
    finally { delete process.env.GOOSE_TEST_REJECT_PUSH; }
    expect(await git(a, "show", "HEAD:note.md")).toBe("keep me");
    await syncGitNotebook(config(a));
    expect(await git(remote, "show", "main:note.md")).toBe("keep me");
  }, 30_000);
  test("rejects URL rewrite, nested repositories and existing merge operations", async () => {
    const { a } = await fixture("guards");
    await syncGitNotebook(config(a));
    await git(a, "config", "url.https://github.com/.insteadOf", "git@github.com:");
    await expect(syncGitNotebook(config(a))).rejects.toThrow("改写");
    await git(a, "config", "--remove-section", "url.https://github.com/");
    const child = join(a, "nested"); await mkdir(child);
    await expect(syncGitNotebook(config(child))).rejects.toThrow("父仓库");
    await writeFile(join(a, ".git", "MERGE_HEAD"), "incomplete");
    await expect(syncGitNotebook(config(a))).rejects.toThrow("未完成");
  }, 30_000);
});
