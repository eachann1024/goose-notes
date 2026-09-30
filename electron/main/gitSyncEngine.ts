import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { lstat, realpath } from "node:fs/promises";
import { type GitSyncConfig, validateGitSyncConfig } from "../../src/lib/git-sync-contract";

const execFile = promisify(nodeExecFile);
const REMOTE = "goose-sync";
const TIMEOUT_MS = 120_000;
const SSH_COMMAND = "ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o NumberOfPasswordPrompts=0 -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=2";

export async function gitBytes(cwd: string, args: string[], timeout = TIMEOUT_MS): Promise<Buffer> {
  try {
    const inheritedEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
    const { stdout } = await execFile("git", [
      "-c", "core.hooksPath=/dev/null",
      "-c", "core.fsmonitor=false",
      "-c", "user.name=Goose Notes",
      "-c", "user.email=goose-notes@localhost",
      "-c", "protocol.allow=never",
      "-c", "protocol.ssh.allow=always",
      "-c", "commit.gpgSign=false",
      "-c", "tag.gpgSign=false",
      "-c", "core.editor=true",
      "-c", "sequence.editor=true",
      ...args,
    ], {
      encoding: "buffer",
      cwd,
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...inheritedEnvironment,
        GIT_ALLOW_PROTOCOL: "ssh",
        GIT_TERMINAL_PROMPT: "0",
        GIT_SSH_COMMAND: SSH_COMMAND,
        SSH_ASKPASS: "/usr/bin/false",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
      },
    });
    return stdout;
  } catch {
    // Do not expose command arguments, local paths, remote output or credentials over IPC.
    throw new Error("Git 操作失败，请检查 SSH、网络、分支权限或仓库状态");
  }
}

async function git(cwd: string, args: string[], timeout = TIMEOUT_MS): Promise<string> {
  return (await gitBytes(cwd, args, timeout)).toString("utf8").trim();
}

function expectedUrl(config: GitSyncConfig): string {
  const host = config.provider === "github" ? "github.com" : "gitee.com";
  const url = config.remoteUrl.trim();
  const match = url.match(new RegExp(`^(?:git@${host.replace(".", "\\.")}:|ssh://git@${host.replace(".", "\\.")}/)([A-Za-z0-9_-][A-Za-z0-9_.-]*/[A-Za-z0-9_-][A-Za-z0-9_.-]*)$`));
  if (!match) throw new Error(`仅支持 ${host} 的 SSH 仓库地址`);
  return `git@${host}:${match[1]}`;
}

async function rejectLocalRewrites(root: string, url: string): Promise<void> {
  let output = "";
  try {
    output = await git(root, ["config", "--local", "--null", "--get-regexp", "^url\\..*\\.(insteadof|pushinsteadof)$"]);
  } catch { /* no rewrite keys */ }
  // Output is NUL-delimited key/value records. Reject rather than risk transport rewriting.
  const records = output.split("\0").filter(Boolean);
  for (const record of records) {
    const separator = record.indexOf("\n");
    if (separator < 0) continue;
    const key = record.slice(0, separator);
    const prefix = record.slice(separator + 1);
    if ((key.endsWith(".insteadof") || key.endsWith(".pushinsteadof")) && url.startsWith(prefix)) {
      throw new Error("仓库配置包含会改写同步地址的 Git 规则，请先移除 url.*.insteadOf/pushInsteadOf 配置");
    }
  }
}

async function isAncestorRepository(path: string): Promise<boolean> {
  try {
    await git(path, ["rev-parse", "--show-toplevel"]);
    return true;
  } catch { return false; }
}

/** Synchronize one notebook directory with its dedicated SSH remote. */
export async function syncGitNotebook(input: GitSyncConfig): Promise<void> {
  const config = validateGitSyncConfig(input);
  const root = await realpath(resolve(config.localPath));
  const url = expectedUrl(config);
  const gitEntry = await lstat(resolve(root, ".git")).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (gitEntry && (!gitEntry.isDirectory() || gitEntry.isSymbolicLink())) throw new Error("同步需要普通 Git 仓库，不支持外置 .git 或 linked worktree");

  let rootRepo = false;
  try {
    const top = await git(root, ["rev-parse", "--show-toplevel"]);
    if (resolve(top) !== root) throw new Error("记事本目录位于其他 Git 仓库内，拒绝在父仓库中同步");
    rootRepo = true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("位于其他 Git 仓库内")) throw error;
  }

  if (!rootRepo) {
    if (gitEntry) throw new Error("现有 Git 仓库无法读取，请检查仓库权限和状态");
    if (await isAncestorRepository(dirname(root))) {
      throw new Error("记事本目录位于其他 Git 仓库内，请移出父仓库后再同步");
    }
    await git(root, ["init", "--initial-branch", config.branch]);
  }

  const top = resolve(await git(root, ["rev-parse", "--show-toplevel"]));
  if (top !== root) throw new Error("Git 仓库根目录必须与记事本目录相同");
  const gitDir = await git(root, ["rev-parse", "--absolute-git-dir"]);
  const commonDir = await git(root, ["rev-parse", "--git-common-dir"]);
  if (resolve(root, commonDir) !== resolve(gitDir)) throw new Error("不支持 Git linked worktree，请使用普通仓库目录");
  const branch = await git(root, ["branch", "--show-current"]);
  if (branch !== config.branch) throw new Error(`当前分支是 ${branch || "（分离 HEAD）"}，请切换到 ${config.branch} 后重试`);

  for (const marker of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"]) {
    if (await lstat(resolve(gitDir, marker)).then(() => true).catch(() => false)) throw new Error("仓库有未完成的合并或变基，请先在终端完成或中止后重试");
  }
  if (await git(root, ["ls-files", "--unmerged"])) throw new Error("仓库存在未解决冲突，请先处理后重试");
  await rejectLocalRewrites(root, url);
  const hasRemote = (await git(root, ["remote"]).catch(() => "")).split("\n").includes(REMOTE);
  if (hasRemote) {
    const currentUrl = await git(root, ["remote", "get-url", REMOTE]);
    if (currentUrl !== url) throw new Error(`专用远程 ${REMOTE} 已配置为其他地址；请先检查后再同步`);
    const pushUrls = await git(root, ["remote", "get-url", "--push", "--all", REMOTE]);
    if (pushUrls !== url) throw new Error(`专用远程 ${REMOTE} 配置了不同的推送地址，请先移除 pushurl`);
  } else {
    await git(root, ["remote", "add", REMOTE, url]);
  }

  // Stage notebook content while excluding common machine/cache files.
  await git(root, ["add", "-A", "--", ".", ":(exclude,glob)**/.DS_Store", ":(exclude,glob)**/Thumbs.db", ":(exclude,glob)**/desktop.ini"]);
  const staged = Boolean(await git(root, ["diff", "--cached", "--name-only"]));
  if (staged) await git(root, ["commit", "-m", "同步笔记"]);

  const remoteBranch = `refs/heads/${config.branch}`;
  const remoteExists = Boolean(await git(root, ["ls-remote", "--heads", url, remoteBranch]));
  const localHead = await git(root, ["rev-parse", "--verify", "HEAD"]).then(() => true).catch(() => false);

  if (remoteExists) {
    await git(root, ["fetch", "--no-tags", "--no-recurse-submodules", url, remoteBranch]);
    const remoteRef = "FETCH_HEAD";
    try {
      const related = localHead && await git(root, ["merge-base", "HEAD", remoteRef]).then(() => true).catch(() => false);
      if (!related) {
        // Unrelated histories are expected for a notebook initialized independently.
        await git(root, ["merge", "--no-edit", "--allow-unrelated-histories", remoteRef]);
      } else {
        await git(root, ["merge", "--no-edit", remoteRef]);
      }
    } catch (error) {
      await git(root, ["merge", "--abort"]).catch(() => undefined);
      throw Object.assign(new Error(`同步合并发生冲突，本地提交和原文件已保留。请手动解决冲突后再同步。${error instanceof Error ? `（${error.message}）` : ""}`), { cause: error });
    }
  } else if (!localHead) {
    // Empty local and remote repositories have nothing to merge or push.
    return;
  }

  // Explicit branch refspec: no force and no use of configured pushurl.
  // Use the checked remote URL directly so a configured pushurl cannot redirect the push.
  try {
    await git(root, ["push", "--no-verify", url, `HEAD:refs/heads/${config.branch}`]);
  } catch (error) {
    throw Object.assign(new Error(`本地提交已保留，但推送失败；请检查 SSH 权限和网络后重试。${error instanceof Error ? `（${error.message}）` : ""}`), { cause: error });
  }
}
