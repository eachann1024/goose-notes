import * as LucideIcons from "lucide-react";
import type { Editor } from "@tiptap/core";
import { toast } from "sonner";
import { getAIAvailability, runAIText, type AIMessage } from "@/lib/ai-provider";
import { useSettings } from "@/stores/useSettings";

interface EditorRange {
  from: number;
  to: number;
}

export interface AiToolbarActionItem {
  title: string;
  description: string;
  icon: typeof LucideIcons.Sparkles;
  shortcut?: string;
  keywords?: string[];
  disabled?: boolean;
  disabledReason?: string;
  command?: (params: { editor: Editor; range: EditorRange }) => Promise<void>;
  children?: AiToolbarActionItem[];
}

const AI_SYSTEM_PROMPT =
  "你是 Goose Note 内置写作助手。输出必须直接可落文，不要解释，不要加前后缀，不要使用 Markdown 代码围栏。";

function extractPlainTextBetween(editor: Editor, from: number, to: number) {
  return editor.state.doc.textBetween(from, to, "\n", "\n").trim();
}

function getCurrentBlockRange(editor: Editor) {
  const { $from } = editor.state.selection;
  return {
    from: $from.start(),
    to: $from.end(),
  };
}

function getCurrentBlockText(editor: Editor) {
  const blockRange = getCurrentBlockRange(editor);
  return extractPlainTextBetween(editor, blockRange.from, blockRange.to);
}

function getSelectedText(editor: Editor) {
  const { from, to, empty } = editor.state.selection;
  if (empty) return "";
  return extractPlainTextBetween(editor, from, to);
}

function getRecentContext(editor: Editor, currentBlockFrom: number, maxBlocks = 3) {
  const snippets: string[] = [];

  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (pos >= currentBlockFrom) return false;

    const text = node.textContent.trim();
    if (text) snippets.push(text);
    return true;
  });

  return snippets.slice(-maxBlocks).join("\n");
}

function ensureAiSupport() {
  return getAIAvailability(useSettings.getState().ai);
}

async function runAiText(messages: AIMessage[]) {
  return runAIText(useSettings.getState().ai, messages);
}

function buildMessages(userPrompt: string) {
  return [
    { role: "system" as const, content: AI_SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt },
  ];
}

async function applyAiAction(params: {
  editor: Editor;
  range: EditorRange;
  mode: "insert" | "replace-selection" | "replace-block" | "insert-task-list";
  prompt: string;
}) {
  const { editor, range, mode, prompt } = params;
  const loadingId = toast.loading("AI 正在处理…");

  try {
    const content = await runAiText(buildMessages(prompt));
    const chain = editor.chain().focus();

    if (range.from !== range.to) {
      chain.deleteRange(range);
    }

    if (mode === "insert") {
      chain.insertContent(content).run();
    } else if (mode === "replace-selection") {
      const { from, to, empty } = editor.state.selection;
      if (!empty) {
        chain.setTextSelection({ from, to }).deleteSelection();
      }
      chain.insertContent(content).run();
    } else if (mode === "replace-block") {
      const blockRange = getCurrentBlockRange(editor);
      chain
        .setTextSelection({ from: blockRange.from, to: blockRange.to })
        .deleteSelection()
        .insertContent(content)
        .run();
    } else {
      const lines = content
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      chain
        .insertContent({
          type: "taskList",
          content: lines.map((line) => ({
            type: "taskItem",
            attrs: { checked: false },
            content: [{ type: "paragraph", content: [{ type: "text", text: line }] }],
          })),
        })
        .run();
    }

    toast.success("AI 已插入结果", { id: loadingId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 执行失败";
    toast.error(message, { id: loadingId });
    throw error;
  }
}

function createAiLeaf(params: {
  title: string;
  description: string;
  icon: typeof LucideIcons.Sparkles;
  keywords?: string[];
  promptBuilder: (editor: Editor) => string | null;
  mode: "insert" | "replace-selection" | "replace-block" | "insert-task-list";
}) {
  const support = ensureAiSupport();

  return {
    title: params.title,
    description: params.description,
    icon: params.icon,
    keywords: params.keywords,
    disabled: !support.ok,
    disabledReason: support.ok ? undefined : support.reason,
    command: async ({ editor, range }: { editor: Editor; range: EditorRange }) => {
      const prompt = params.promptBuilder(editor);
      if (!prompt) {
        toast("当前内容不足，暂时无法执行这个 AI 动作", { duration: 1800 });
        return;
      }

      await applyAiAction({
        editor,
        range,
        mode: params.mode,
        prompt,
      });
    },
  } satisfies AiToolbarActionItem;
}

export function getAiToolbarItems(): AiToolbarActionItem[] {
  return [
    {
      title: "继续写作",
      description: "沿着当前语境继续往下写",
      icon: LucideIcons.WandSparkles,
      children: [
        createAiLeaf({
          title: "自然续写",
          description: "接着上文写一段自然衔接内容",
          icon: LucideIcons.PenLine,
          keywords: ["续写", "接着写", "continue"],
          mode: "insert",
          promptBuilder: (editor) => {
            const blockRange = getCurrentBlockRange(editor);
            const context = getRecentContext(editor, blockRange.from);
            return context
              ? `基于以下已有内容，自然续写 1 段中文正文，语气保持一致：\n\n${context}`
              : null;
          },
        }),
        createAiLeaf({
          title: "延展成要点",
          description: "把上文延展开，补成清晰条目",
          icon: LucideIcons.ListChecks,
          keywords: ["扩写", "要点", "outline"],
          mode: "insert",
          promptBuilder: (editor) => {
            const blockRange = getCurrentBlockRange(editor);
            const context = getRecentContext(editor, blockRange.from);
            return context ? `基于以下内容继续展开，输出简洁的中文要点列表：\n\n${context}` : null;
          },
        }),
      ],
    },
    {
      title: "改写处理",
      description: "润色、正式化或翻译当前内容",
      icon: LucideIcons.RefreshCcw,
      children: [
        createAiLeaf({
          title: "润色当前块",
          description: "保留原意，让表述更顺",
          icon: LucideIcons.Sparkles,
          keywords: ["润色", "polish"],
          mode: "replace-block",
          promptBuilder: (editor) => {
            const text = getSelectedText(editor) || getCurrentBlockText(editor);
            return text ? `请润色下面这段中文，保留原意，输出纯文本：\n\n${text}` : null;
          },
        }),
        createAiLeaf({
          title: "改得更正式",
          description: "适合文档、邮件、方案语气",
          icon: LucideIcons.BriefcaseBusiness,
          keywords: ["正式", "professional"],
          mode: "replace-block",
          promptBuilder: (editor) => {
            const text = getSelectedText(editor) || getCurrentBlockText(editor);
            return text ? `请将下面内容改写得更正式、更适合文档语气，输出纯文本：\n\n${text}` : null;
          },
        }),
        createAiLeaf({
          title: "翻成英文",
          description: "翻译当前块，保持自然表达",
          icon: LucideIcons.Languages,
          keywords: ["翻译", "英文", "english"],
          mode: "replace-block",
          promptBuilder: (editor) => {
            const text = getSelectedText(editor) || getCurrentBlockText(editor);
            return text ? `请把下面内容翻译成自然英文，输出纯文本：\n\n${text}` : null;
          },
        }),
      ],
    },
    {
      title: "理解提炼",
      description: "总结重点或抽成待办",
      icon: LucideIcons.ScanSearch,
      children: [
        createAiLeaf({
          title: "总结当前块",
          description: "提炼成简短摘要并插入下一行",
          icon: LucideIcons.FileText,
          keywords: ["总结", "摘要", "summary"],
          mode: "insert",
          promptBuilder: (editor) => {
            const text = getSelectedText(editor) || getCurrentBlockText(editor);
            return text ? `请总结下面内容，输出 1 段简洁中文摘要：\n\n${text}` : null;
          },
        }),
        createAiLeaf({
          title: "提炼待办",
          description: "把内容拆成可执行任务",
          icon: LucideIcons.ListTodo,
          keywords: ["todo", "任务", "待办"],
          mode: "insert-task-list",
          promptBuilder: (editor) => {
            const text = getSelectedText(editor) || getCurrentBlockText(editor);
            return text ? `请从下面内容中提炼出待办事项，每行一个简短任务，不要编号：\n\n${text}` : null;
          },
        }),
      ],
    },
  ];
}
