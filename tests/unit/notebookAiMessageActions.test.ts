import { expect, test } from "playwright/test";
import { readFileSync } from "node:fs";

const messageSource = readFileSync(
  "src/pages/workspace/components/notebook-ai/ChatMessages.tsx",
  "utf8",
);
const notebookAiCss = readFileSync(
  "src/pages/workspace/styles/notebook-ai.css",
  "utf8",
);

test("消息操作栏固定占位并只切换可见性", () => {
  expect(messageSource).toContain(
    "notebook-ai-message-actions mt-1 flex h-6 min-h-6",
  );
  expect(messageSource).toContain('autohide="never"');
  expect(messageSource).not.toContain("empty:hidden");

  expect(notebookAiCss).toContain(".notebook-ai-message-actions {");
  expect(notebookAiCss).toContain("opacity: 0;");
  expect(notebookAiCss).toContain(
    ".notebook-ai-message:hover > .notebook-ai-message-actions",
  );
  expect(notebookAiCss).toContain(
    ".notebook-ai-message:focus-within > .notebook-ai-message-actions",
  );
});

test("助手消息不再套灰气泡，进度走与审批卡同级的工作卡", () => {
  expect(messageSource).toContain("notebook-ai-message-assistant");
  expect(messageSource).toContain("ToolProgressCard");
  expect(messageSource).not.toContain("collectWorkCardCommentary");
  expect(messageSource).not.toContain("thinkingText");
  expect(messageSource).not.toContain(
    "rounded-[14px] bg-[var(--goose-interactive-hover)]",
  );
  expect(messageSource).not.toContain(
    'bg-[var(--goose-block-subtle-bg)] px-3.5 py-2.5',
  );
});

test("对话列跟审批卡同一张纸，不透外壳灰底", () => {
  expect(notebookAiCss).toContain(".notebook-ai-message-assistant");
  expect(notebookAiCss).toContain("background: transparent");
  expect(notebookAiCss).toContain("0 8px 22px");
  expect(notebookAiCss).not.toMatch(
    /\.notebook-ai-messages \.bui-approval[\s\S]{0,80}box-shadow:\s*none/,
  );
  expect(messageSource).not.toContain("hover:bg-background/60");
  const buiCss = readFileSync(
    "src/pages/workspace/styles/beautiful-ui.css",
    "utf8",
  );
  expect(buiCss).toContain(".notebook-ai-messages");
  expect(buiCss).toContain("background: hsl(var(--goose-editor-bg))");
  expect(buiCss).not.toMatch(
    /\.notebook-ai-messages[\s\S]{0,200}background:\s*var\(--bui-canvas/,
  );
});

test("工作卡与审批卡共用纸面，步骤图标锁 14px、不套任务卡", () => {
  const cardSource = readFileSync(
    "src/pages/workspace/components/notebook-ai/ToolProgressCard.tsx",
    "utf8",
  );
  expect(notebookAiCss).toContain(".notebook-ai-work-card");
  expect(notebookAiCss).toContain("width: 14px");
  expect(notebookAiCss).toContain("padding-left: 42px");
  expect(notebookAiCss).toContain("margin: 12px 0 0 -22px");
  expect(notebookAiCss).not.toContain("grid-template-rows: 0fr");
  expect(cardSource).toContain('width="14"');
  expect(cardSource).not.toContain("TaskRows");
  expect(cardSource).toContain("useState(false)");
  expect(cardSource).toContain("foldable && open");
  expect(cardSource).not.toContain("thinkingText");
  expect(cardSource).not.toContain("visibleBusyTickerLine");
  expect(messageSource).toContain("collectReasoningText");
  expect(messageSource).not.toContain("thinkingText");
});

test("生成时吸底不因回到底部按钮抢高度", () => {
  expect(messageSource).toContain("overflow-y-scroll");
  expect(messageSource).toContain("h-0 justify-center");
  expect(messageSource).toContain("pointer-events-none sticky");
  expect(notebookAiCss).toContain("overflow-anchor: none");
  expect(notebookAiCss).not.toMatch(
    /\.notebook-ai-work-card \{[\s\S]{0,120}animation:\s*bui-fade-up/,
  );
});

test("发送后直接显示处理进度，不再出独立思考中卡片", () => {
  expect(messageSource).toContain("showWorkCard");
  expect(messageSource).toContain("ToolProgressCard");
  expect(messageSource).not.toContain("AssistantThinkingPlaceholder");
  expect(messageSource).not.toContain('activeLabel="思考中"');
  expect(messageSource).not.toContain("ThinkingState");
});
