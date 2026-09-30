/**
 * mermaid 动态 import 只拉一次。页面里已有 mermaid 块时尽早 preload，
 * 把解析从「预览开始渲」挪到编辑器初始化重叠段。
 */

type MermaidModule = typeof import("mermaid");

let pending: Promise<MermaidModule> | null = null;

export function preloadMermaid(): Promise<MermaidModule> {
  pending ??= import("mermaid");
  return pending;
}

export async function loadMermaid() {
  const mod = await preloadMermaid();
  return mod.default;
}

export function pageHasMermaidBlock(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const node = block as {
      type?: string;
      props?: { language?: string };
      children?: unknown;
    };
    if (node.type === "codeBlock" && node.props?.language === "mermaid") {
      return true;
    }
    if (pageHasMermaidBlock(node.children)) return true;
  }
  return false;
}
