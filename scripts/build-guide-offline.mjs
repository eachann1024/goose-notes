import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist-guide");
const sourceHtmlPath = path.join(distDir, "guide.html");
const outputHtmlPath = path.join(distDir, "guide-offline.html");

const html = await readFile(sourceHtmlPath, "utf8");
const scriptMatch = html.match(
  /<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/,
);
const styleMatch = html.match(
  /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/,
);

if (!scriptMatch || !styleMatch) {
  throw new Error("无法定位指南构建产物中的脚本或样式资源");
}

const resolveBuiltAsset = (relativePath) =>
  path.resolve(distDir, relativePath.replace(/^\.\//, ""));

let script = await readFile(resolveBuiltAsset(scriptMatch[1]), "utf8");
const style = await readFile(resolveBuiltAsset(styleMatch[1]), "utf8");

const inlineImages = [
  ["hero-rabbit-goose.webp", "image/webp"],
  ["search-highlight.webp", "image/webp"],
  ["create-anything.webp", "image/webp"],
  ["ai-and-safety.webp", "image/webp"],
];

for (const [filename, mimeType] of inlineImages) {
  const image = await readFile(path.join(distDir, "guide", "images", filename));
  const sourcePath = `./guide/images/${filename}`;
  const dataUrl = `data:${mimeType};base64,${image.toString("base64")}`;
  script = script.split(sourcePath).join(dataUrl);
}

// 避免内联脚本内容意外提前闭合 script 标签。
script = script.replaceAll("</script", "<\\/script");

const offlineHtml = html
  // 构建后的 bundle 不含外部 import，可用经典脚本运行；file:// 会拦截模块脚本。
  // 使用回调返回替换文本，避免 bundle 内的 `$&` 被 String.replace 当成匹配占位符。
  .replace(scriptMatch[0], "")
  .replace(styleMatch[0], () => `<style>${style}</style>`)
  .replace(/\s*<meta property="og:image"[^>]*>/, "")
  .replace(/\s*<meta name="twitter:image"[^>]*>/, "")
  .replace(
    "<title>鹅的笔记 · 功能指南</title>",
    "<title>鹅的笔记 · 功能指南（离线版）</title>",
  )
  // 经典脚本必须放在 #root 之后执行，否则 React 找不到挂载节点。
  .replace("</body>", () => `<script>${script}</script></body>`);

await writeFile(outputHtmlPath, offlineHtml, "utf8");
console.log(`[guide-offline] ${outputHtmlPath}`);
