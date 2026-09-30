/** Electron 桌面端为「仅本地文件夹」模式（Obsidian 式仓库），无内置笔记本。 */
export const isElectronHost = __HOST_TARGET__ === "electron";
