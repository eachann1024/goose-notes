import { expect, test } from "playwright/test";
import {
  localAssetPaths,
  restoreMissingReferencedLocalAssets,
  scanUnreferencedLocalAssets,
} from "../../src/lib/local-folder-asset-maintenance";

interface Entry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  path: string;
  size: number;
}

function createFs(
  entries: Record<string, Entry[]>,
  files: Record<string, string> = {},
  options: {
    existing?: Set<string>;
    restoreFromTrash?: (path: string) => Promise<boolean>;
  } = {},
) {
  const knownPaths = new Set(options.existing);
  for (const [dir, dirEntries] of Object.entries(entries)) {
    knownPaths.add(dir);
    for (const entry of dirEntries) knownPaths.add(entry.path);
  }
  Object.keys(files).forEach((path) => knownPaths.add(path));

  return {
    readDir: (path: string) => entries[path] ?? [],
    readFile: (path: string) => files[path] ?? null,
    writeFile: () => false,
    exists: (path: string) => knownPaths.has(path),
    watch: () => undefined,
    unwatch: () => undefined,
    mkdir: () => false,
    deleteFile: () => false,
    deleteDir: () => false,
    rename: () => false,
    restoreFromTrash: options.restoreFromTrash,
  };
}

function file(
  path: string,
  size = 8,
): Entry {
  const name = path.split("/").pop() ?? path;
  return {
    name,
    isFile: true,
    isDirectory: false,
    path,
    size,
  };
}

test("扫描深层内容中的本地资源引用，并保留根 assets 兼容目录", async () => {
  const result = await scanUnreferencedLocalAssets({
    basePath: "/notes",
    gooseFs: createFs({
      "/notes/assets": [
        file("/notes/assets/legacy.png", 12),
        file("/notes/assets/unused.png"),
      ],
      "/notes/project/assets": [file("/notes/project/assets/used.mp4", 20)],
    }),
    pages: [
      {
        localFilePath: "/notes/project/note.md",
        isFolder: false,
        content: {
          type: "doc",
          content: [
            {
              type: "table",
              rows: [
                {
                  cells: [
                    {
                      children: [
                        { type: "video", props: { src: "./assets/used.mp4" } },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "image",
              attrs: { url: "/notes/assets/legacy.png" },
            },
          ],
        },
      },
    ],
  });

  expect(result).toEqual([
    {
      path: "/notes/assets/unused.png",
      relativePath: "assets/unused.png",
      name: "unused.png",
      size: 8,
    },
  ]);
});

test("行内图片、Wiki 嵌入和 HTML 引用不会被当成未引用", async () => {
  const result = await scanUnreferencedLocalAssets({
    basePath: "/notes",
    gooseFs: createFs(
      {
        "/notes": [
          {
            name: "note.md",
            isFile: true,
            isDirectory: false,
            path: "/notes/note.md",
            size: 1,
          },
        ],
        "/notes/assets": [
          file("/notes/assets/inline.png"),
          file("/notes/assets/wiki.png"),
          file("/notes/assets/html.png"),
          file("/notes/assets/titled.png"),
          file("/notes/assets/unused.png"),
        ],
      },
      {
        "/notes/note.md": [
          "see ![cover](./assets/inline.png) here",
          "![[wiki.png]]",
          '<img src="./assets/html.png">',
          '![shot](./assets/titled.png "title")',
        ].join("\n"),
      },
    ),
    pages: [
      {
        localFilePath: "/notes/note.md",
        isFolder: false,
        content: [{ type: "paragraph", content: "placeholder" }],
      },
    ],
  });

  expect(result.map((asset) => asset.name)).toEqual(["unused.png"]);
});

test("子页面用仓库根相对路径引用 assets 时不会误删", async () => {
  const result = await scanUnreferencedLocalAssets({
    basePath: "/notes",
    gooseFs: createFs({
      "/notes/assets": [
        file("/notes/assets/root.png"),
        file("/notes/assets/unused.png"),
      ],
    }),
    pages: [
      {
        localFilePath: "/notes/project/deep/note.md",
        isFolder: false,
        content: {
          type: "paragraph",
          content: [
            { type: "link", href: "assets/root.png", content: "root" },
          ],
        },
      },
    ],
  });

  expect(result.map((asset) => asset.name)).toEqual(["unused.png"]);
});

test("隐藏目录里的笔记仍能保护根 assets 中的图片", async () => {
  const result = await scanUnreferencedLocalAssets({
    basePath: "/notes",
    gooseFs: createFs(
      {
        "/notes": [
          {
            name: "archive",
            isFile: false,
            isDirectory: true,
            path: "/notes/archive",
            size: 0,
          },
        ],
        "/notes/archive": [
          {
            name: "hidden.md",
            isFile: true,
            isDirectory: false,
            path: "/notes/archive/hidden.md",
            size: 1,
          },
        ],
        "/notes/assets": [
          file("/notes/assets/kept.png"),
          file("/notes/assets/unused.png"),
        ],
      },
      {
        "/notes/archive/hidden.md": "![](../assets/kept.png)",
      },
    ),
    pages: [],
  });

  expect(result.map((asset) => asset.name)).toEqual(["unused.png"]);
});

test("缺失的被引用文件会优先从废纸篓还原到原 assets 路径", async () => {
  const restored: string[] = [];
  const existing = new Set(["/notes/assets/unused.png"]);
  const result = await restoreMissingReferencedLocalAssets({
    basePath: "/notes",
    gooseFs: createFs(
      {
        "/notes": [
          {
            name: "note.md",
            isFile: true,
            isDirectory: false,
            path: "/notes/note.md",
            size: 1,
          },
        ],
        "/notes/assets": [file("/notes/assets/unused.png")],
      },
      {
        "/notes/note.md": "![](./assets/kept.png)",
      },
      {
        existing,
        restoreFromTrash: async (path) => {
          restored.push(path);
          existing.add(path);
          return true;
        },
      },
    ),
    pages: [
      {
        localFilePath: "/notes/note.md",
        isFolder: false,
        content: [],
      },
    ],
  });

  expect(restored).toEqual(["/notes/assets/kept.png"]);
  expect(result.restored).toEqual(["/notes/assets/kept.png"]);
  expect(result.missing).toEqual([]);
});

test("笔记在 assets 目录下时，内部附件引用也不会被当成本地资源路径", () => {
  expect(
    localAssetPaths.resolveLocalAssetPath(
      "att-file:goose-file/report.pdf",
      "/notes/assets/note.md",
    ),
  ).toBeNull();
  expect(
    localAssetPaths.resolveLocalAssetPath(
      "att-video:goose-video/clip.mp4",
      "/notes/assets/note.md",
    ),
  ).toBeNull();
  expect(
    localAssetPaths.resolveLocalAssetPath(
      "./assets/used.mp4",
      "/notes/project/note.md",
    ),
  ).toBe("/notes/project/assets/used.mp4");
  expect(
    localAssetPaths.resolveLocalAssetPath(
      './assets/used.png "title"',
      "/notes/project/note.md",
    ),
  ).toBe("/notes/project/assets/used.png");
});
