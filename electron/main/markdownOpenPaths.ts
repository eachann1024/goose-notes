/**
 * 从启动参数里挑出要打开的 Markdown 路径（纯函数，便于单测）。
 * 实际存在性、绝对路径解析在 openMarkdownFiles.ts 里做。
 */

const MARKDOWN_EXT = /\.(md|markdown)$/i;

export type ArgvOpenOptions = {
  packaged: boolean;
  execPath: string;
};

export function isMarkdownDocumentPath(filePath: string): boolean {
  const trimmed = filePath.trim();
  if (!trimmed) return false;
  const base = trimmed.split(/[\\/]/).pop() ?? trimmed;
  return MARKDOWN_EXT.test(base);
}

function looksLikeFlag(arg: string): boolean {
  return arg.startsWith("-");
}

/**
 * 开发态 argv：`electron dist-electron/main/index.js [files...]`
 * 包装态 argv：`Goose Note.exe [files...]`（macOS 文件走 open-file，不依赖 argv）
 */
export function collectMarkdownPathsFromArgv(
  argv: string[],
  options: ArgvOpenOptions,
): string[] {
  const start = options.packaged ? 1 : 2;
  const skip = new Set(
    [options.execPath, argv[0], options.packaged ? "" : (argv[1] ?? "")]
      .filter((value) => value.length > 0),
  );
  const out: string[] = [];
  const seen = new Set<string>();

  for (let index = start; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg || looksLikeFlag(arg) || arg === ".") continue;
    if (skip.has(arg)) continue;
    if (!isMarkdownDocumentPath(arg)) continue;
    if (seen.has(arg)) continue;
    seen.add(arg);
    out.push(arg);
  }

  return out;
}
