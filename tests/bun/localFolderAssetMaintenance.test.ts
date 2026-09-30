import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm, realpath, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanUnreferencedLocalAssets, type AssetMaintenanceFs } from "../../src/lib/local-folder-asset-maintenance";
import { assetFingerprint, notebookScanFs } from "../../electron/main/assetMaintenanceFiles";
import { setLocalMdSnapshot, clearAllLocalMdSnapshots } from "../../src/lib/local-md-snapshot";

const roots: string[] = [];
async function fixture(files: Record<string, string>) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "goose-assets-test-")));
  roots.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}
afterEach(async () => {
  clearAllLocalMdSnapshots();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const scan = (root: string, pages: Parameters<typeof scanUnreferencedLocalAssets>[0]["pages"] = [], gooseFs: AssetMaintenanceFs = notebookScanFs(root)) => scanUnreferencedLocalAssets({ basePath: root, pages, gooseFs });

describe("local-folder asset maintenance", () => {
  test("only images/videos under notebook assets; JS references are not analyzed", async () => {
    const root = await fixture({
      "assets/unused.png": "image", "assets/movie.mp4": "video", "nested/assets/clip.webm": "video",
      "assets/code.js": 'const img = "assets/unused.png";', "assets/theme.css": "", "assets/page.html": "",
      "assets/file.pdf": "", "assets/audio.mp3": "", "assets/data.json": "", "outside.png": "image",
    });
    expect((await scan(root)).map((asset) => asset.relativePath)).toEqual(["assets/movie.mp4", "assets/unused.png", "nested/assets/clip.webm"]);
  });
  test("protect disk references in hidden folders and assets Markdown plus unsaved editors", async () => {
    const root = await fixture({
      ".hidden/note.md": "![image](../assets/hidden.png)", "assets/note.markdown": "[video](clip.mp4)",
      "note.md": "![fresh](assets/disk.png)", "assets/hidden.png": "", "assets/clip.mp4": "", "assets/disk.png": "",
      "assets/unsaved.png": "", "assets/unused.png": "",
    });
    setLocalMdSnapshot(`${root}/note.md`, "stale snapshot without images");
    const pages = [{ localFilePath: `${root}/note.md`, content: [{ type: "image", props: { url: "assets/unsaved.png" } }] as any }];
    expect((await scan(root, pages)).map((asset) => asset.name)).toEqual(["unused.png"]);
  });
  test("reference definitions, spaces, parentheses, wiki and HTML references", async () => {
    const root = await fixture({
      "note.md": '![x][ref]\n[ref]: <assets/with space.png>\n![x](assets/a(b).png)\n![[wiki.png]] ![[photo.heic]]\n<video src="assets/video.mp4"></video>',
      "assets/with space.png": "", "assets/a(b).png": "", "assets/wiki.png": "", "assets/photo.heic": "", "assets/video.mp4": "",
    });
    expect(await scan(root)).toEqual([]);
  });
  test("other notebook pages cannot expand candidates or references", async () => {
    const root = await fixture({ "assets/one.png": "" });
    const other = await fixture({ "assets/two.png": "", "note.md": "" });
    const pages = [{ localFilePath: `${other}/note.md`, content: [{ type: "image", props: { url: "assets/one.png" } }] as any }];
    expect((await scan(root, pages)).map((asset) => asset.path)).toEqual([`${root}/assets/one.png`]);
  });
  test("directory and Markdown read failures stop scan rather than omit references", async () => {
    const root = await fixture({ "note.md": "", "assets/one.png": "" });
    await expect(scan(root, [], { ...notebookScanFs(root), readFileAsync: async () => null })).rejects.toThrow("无法读取 Markdown");
    await expect(scan(root, [], { ...notebookScanFs(root), readDirAsync: async () => { throw new Error("permission denied"); } })).rejects.toThrow("permission denied");
  });
  test("reject symlink traversal and fabricated outside entries", async () => {
    const root = await fixture({ "assets/one.png": "" });
    const other = await fixture({ "note.md": "" });
    await symlink(other, `${root}/linked`);
    await expect(scan(root)).rejects.toThrow("符号链接");
    await expect(scan(root, [], { ...notebookScanFs(root), readDirAsync: async () => [{ path: `${other}/two.png`, name: "two.png", isFile: true, isDirectory: false }] })).rejects.toThrow("超出笔记本");
  });
  test("file replacement invalidates fingerprint; scan never restores from trash", async () => {
    const root = await fixture({ "assets/one.png": "one" });
    const before = await assetFingerprint(root, `${root}/assets/one.png`);
    await writeFile(`${root}/assets/one.png`, "two");
    expect(await assetFingerprint(root, `${root}/assets/one.png`)).not.toBe(before);
    let restored = false;
    await scan(root, [], { ...notebookScanFs(root), restoreFromTrash: async () => { restored = true; return true; } });
    expect(restored).toBe(false);
  });
  test("new disk references between scans remove deletion candidates", async () => {
    const root = await fixture({ "note.md": "", "assets/one.png": "" });
    expect(await scan(root)).toHaveLength(1);
    await writeFile(`${root}/note.md`, "![now used](assets/one.png)");
    expect(await scan(root)).toEqual([]);
  });
});
