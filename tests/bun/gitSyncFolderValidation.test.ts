import { test, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, symlink, rm, readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateGitSyncFolder } from "../../electron/main/gitRepositoryEngine";

test("read-only folder preflight rejects sync blockers and accepts corrected folders", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "goose-folder-check-")));
  try {
    await writeFile(join(root, "note.md"), "unchanged");
    await validateGitSyncFolder(root);
    await symlink(join(root, "note.md"), join(root, "linked.md"));
    await expect(validateGitSyncFolder(root)).rejects.toThrow("符号链接");
    await rm(join(root, "linked.md"));
    await writeFile(join(root, "CON.md"), "reserved");
    await expect(validateGitSyncFolder(root)).rejects.toThrow("跨平台");
    await rm(join(root, "CON.md"));
    await mkdir(join(root, "node_modules"));
    await symlink(join(root, "note.md"), join(root, "node_modules", "ignored"));
    await validateGitSyncFolder(root);
    expect(await readFile(join(root, "note.md"), "utf8")).toBe("unchanged");
    await expect(validateGitSyncFolder(join(root, "missing"))).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true }); }
});
