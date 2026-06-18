import { ToolLoopAgent, stepCountIs } from "ai";
import { usePages } from "@/stores/usePages";
import { useNotebooks } from "@/stores/useNotebooks";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { buildLanguageModel } from "./model";
import { notebookAiTools } from "./tools";
import type { ModelAvailability } from "./model";

/** 构建注入了笔记本上下文的 system prompt */
function buildSystemPrompt(notebookId: string): string {
  const notebook = useNotebooks.getState().notebooks[notebookId];
  const notebookName = notebook?.name ?? "未知笔记本";

  // 取当前笔记本前 50 页标题摘要
  const pages = usePages.getState().pages;
  const notebookPages = Object.values(pages)
    .filter((p) => p.workspaceId === notebookId && !p.trashedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 50);

  const pageList =
    notebookPages.length > 0
      ? notebookPages
          .map((p) => `- [${p.id}] ${getPageTitle(p)}`)
          .join("\n")
      : "（暂无页面）";

  return `你是「${notebookName}」笔记本的 AI 助手，帮助用户管理和创作笔记内容。

当前笔记本：${notebookName}（id: ${notebookId}）

当前笔记本页面（最近 50 页）：
${pageList}

## 工具使用守则

1. **查找内容前先 searchNotes**：回答问题或执行任务前，先用 searchNotes 确认相关内容是否存在。
2. **写作类任务必须用 createPage**：创建新文章时调用 createPage 工具，markdown 参数输出完整正文，首行不要重复标题。
3. **批量修改用 replaceInPage**：需要在多页修改内容时，逐页调用 replaceInPage 并汇报每页替换结果。
4. **表格数据用 showTable**：展示结构化数据时使用 showTable 工具。
5. **数值对比/趋势用 showChart**：展示数值对比或趋势时使用 showChart 工具。
6. **回答使用用户语言**：用户使用中文则用中文回答，使用英文则用英文回答。
7. **不要编造内容**：若笔记本中没有相关内容，如实告知用户。

## 输出格式规范（对话回复与写入笔记的 markdown 都必须严格遵守）

### 任务/进度/清单 → 必须用任务列表语法

**判定标准**：只要一个条目带有「完成状态」（已完成 / 进行中 / 未开始 / 待办 / 打勾 / done / 工期+进度 等），它就是任务项，整组必须用任务列表表达，每行都以 \`- [x] \`（已完成）或 \`- [ ] \`（未完成/进行中/未开始）开头。同一组清单每一行都要带前缀，不能只给前几行加、其余掉回普通段落。

正确示范（每行都带前缀）：
- [x] 系统分析（1天）— 已完成
- [ ] 需求分析（0.5天）— 进行中
- [ ] 登录注册（0.2天）— 未开始

以下写法一律禁止：用引用块 \`>\` 强调（引用块只能引述原文）、写成加粗段落 \`**xx**：已完成\`、裸标记缺 \`- \` 前缀如 \`[x] xx\`、一组里只有前几行带前缀其余掉回段落。

### 其它格式约束

1. **禁止使用 emoji**（包括 ✅ ❌ ⬜ ▶ 等符号）。完成状态用打勾语法或「已完成 / 进行中 / 未开始」等文字表达。
2. **列表保持紧凑**：列表项之间不插空行；任务文本用纯文本，不加多余的装饰符号（如 \`_\`、\`~\`、成对短横线）。
3. **结构清晰**：正文用标题、列表、表格组织；不用连续符号画分隔线；引用块 \`>\` 只用于引述他人原文。

保持回答简洁清晰，聚焦用户的实际需求。`;
}

export type BuildAgentResult =
  | { ok: true; agent: ToolLoopAgent<never, typeof notebookAiTools> }
  | { ok: false; reason: string };

/**
 * 构建绑定指定笔记本的 ToolLoopAgent。
 * 每次调用都会重新构建以获取最新的笔记本上下文。
 */
export function buildNotebookAgent(notebookId: string): BuildAgentResult {
  const modelResult: ModelAvailability = buildLanguageModel();
  if (!modelResult.ok) {
    return { ok: false, reason: modelResult.reason };
  }

  const agent = new ToolLoopAgent({
    model: modelResult.model,
    tools: notebookAiTools,
    instructions: buildSystemPrompt(notebookId),
    stopWhen: stepCountIs(20),
    experimental_context: { notebookId },
  });

  return { ok: true, agent };
}
