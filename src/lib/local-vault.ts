import { toast } from "@/components/ui/sonner";
import { dialogs } from "@/lib/utools/dialogs";
import { useNotebooks } from "@/stores/useNotebooks";
import { usePages } from "@/stores/usePages";

/** Electron 桌面端为「仅本地文件夹」模式（Obsidian 式仓库），无内置笔记本。 */
export const isElectronHost = __HOST_TARGET__ === "electron";

const WELCOME_FILE_NAME = "欢迎.md";

const WELCOME_MARKDOWN = `# 欢迎使用鹅的笔记

这个文件夹就是你的笔记仓库，所有内容都以 Markdown 文件保存在本地磁盘。

- 在左侧侧边栏新建文件或文件夹
- 拖入已有的 .md 文件也能直接打开
- 设置里可以配置文件管理器、外部编辑器等打开方式
`;

/** 选择新建仓库的父目录（uTools 优先走原生 showOpenDialog）。 */
export async function pickVaultParentDirectory(): Promise<string | null> {
  const utools = (
    window as {
      utools?: {
        showOpenDialog?: (options: {
          title: string;
          properties: string[];
        }) => Promise<string[] | null>;
      };
    }
  ).utools;
  if (typeof utools?.showOpenDialog === "function") {
    const result = await utools.showOpenDialog({
      title: "选择仓库的父目录",
      properties: ["openDirectory", "createDirectory"],
    });
    return result && result.length > 0 ? result[0] : null;
  }
  try {
    return await dialogs.selectDirectory();
  } catch (error) {
    console.error("[vault] 选择父目录失败", error);
    toast.error("选择目录失败: " + String(error));
    return null;
  }
}

/**
 * 新建仓库：在父目录下 mkdir <name>，写入欢迎笔记，再挂载为 local-folder 笔记本。
 * 成功返回 notebookId；失败已 toast，返回 null。
 */
export async function createVaultNotebook(
  parentDir: string,
  rawName: string,
): Promise<string | null> {
  const name = rawName.trim().replace(/[\\/:*?"<>|]/g, "_");
  if (!name) {
    toast.error("请输入仓库名称");
    return null;
  }
  const gooseFs = typeof window !== "undefined" ? window.gooseFs : undefined;
  if (!gooseFs) {
    toast.error("文件系统不可用");
    return null;
  }

  const separator = parentDir.includes("\\") && !parentDir.includes("/") ? "\\" : "/";
  const base = parentDir.replace(/[\\/]+$/, "");
  const vaultPath = `${base}${separator}${name}`;

  const exists = gooseFs.existsAsync
    ? await gooseFs.existsAsync(vaultPath)
    : gooseFs.exists(vaultPath);
  if (exists) {
    toast.error("同名文件夹已存在", { description: vaultPath });
    return null;
  }

  const created = await Promise.resolve(gooseFs.mkdir(vaultPath));
  if (!created) {
    toast.error("创建文件夹失败", { description: vaultPath });
    return null;
  }

  // 默认写入一篇欢迎笔记（仅在用户主动完成新建流程时写盘）
  const welcomePath = `${vaultPath}${separator}${WELCOME_FILE_NAME}`;
  try {
    if (gooseFs.writeFileAsync) {
      await gooseFs.writeFileAsync(welcomePath, WELCOME_MARKDOWN);
    } else {
      gooseFs.writeFile(welcomePath, WELCOME_MARKDOWN);
    }
  } catch (error) {
    console.warn("[vault] 欢迎笔记写入失败", error);
  }

  const notebookId = useNotebooks.getState().createLocalFolderNotebook(name, vaultPath);
  await usePages.getState().loadLocalFolderPages(notebookId, vaultPath, {
    showWelcome: false,
  });
  toast.success("仓库已创建", { description: vaultPath });
  return notebookId;
}
