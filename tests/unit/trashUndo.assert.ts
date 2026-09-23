// Run: bun tests/unit/trashUndo.assert.ts
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { trashWithUndo, undoTrash } from "../../electron/main/trashUndo";

const dir = await mkdtemp(path.join(os.tmpdir(), "goose-trash-undo-test-"));
const backup = path.join(dir, "backups");
const bin = path.join(dir, "bin");
await mkdir(bin);
const moveToBin = (src: string) => rename(src, path.join(bin, path.basename(src)));
try {
  const file = path.join(dir, "note.md");
  await writeFile(file, "original");
  const token = await trashWithUndo(file, backup, moveToBin);
  await writeFile(file, "new file");
  await assert.rejects(undoTrash(token), /原位置已有同名文件/);
  assert.equal(await readFile(file, "utf8"), "new file");
  await rm(file);
  assert.equal(await undoTrash(token), file);
  assert.equal(await readFile(file, "utf8"), "original");
  assert.equal(await readFile(path.join(bin, "note.md"), "utf8"), "original");

  const folder = path.join(dir, "folder");
  await mkdir(folder);
  await writeFile(path.join(folder, "child.md"), "child");
  const folderToken = await trashWithUndo(folder, backup, moveToBin);
  await undoTrash(folderToken);
  assert.equal(await readFile(path.join(folder, "child.md"), "utf8"), "child");

  const fail = path.join(dir, "fail.md");
  await writeFile(fail, "safe");
  await assert.rejects(trashWithUndo(fail, backup, async () => { throw new Error("trash unavailable"); }));
  assert.equal(await readFile(fail, "utf8"), "safe");
} finally {
  await rm(dir, { recursive: true, force: true });
}
