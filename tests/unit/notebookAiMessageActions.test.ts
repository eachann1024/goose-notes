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

test("助手消息不再套灰气泡，正文进工作卡、审批嵌工作卡 footer", () => {
  expect(messageSource).toContain("notebook-ai-message-assistant");
  expect(messageSource).toContain("ToolProgressCard");
  expect(messageSource).toContain("components={ASSISTANT_TEXT_PARTS}");
  expect(messageSource).toContain("components={ASSISTANT_APPROVAL_PARTS}");
  expect(messageSource).toContain("components={ASSISTANT_ARTIFACT_PARTS}");
  expect(messageSource).toContain("embedded");
  expect(messageSource).not.toContain("ASSISTANT_MESSAGE_PARTS");
  expect(messageSource).not.toContain("collectWorkCardCommentary");
  expect(messageSource).toContain("thinkingText={reasoningText}");
  expect(messageSource).not.toContain(
    "rounded-[14px] bg-[var(--goose-interactive-hover)]",
  );
  expect(messageSource).not.toContain(
    'bg-[var(--goose-block-subtle-bg)] px-3.5 py-2.5',
  );
});

test("消息操作 hover 用强调色前景，助手仍不套灰气泡", () => {
  expect(messageSource).toContain(
    "hover:bg-[var(--goose-interactive-hover)] hover:text-[var(--goose-interactive-selected-fg)]",
  );
  expect(messageSource).not.toContain(
    "rounded-[14px] bg-[var(--goose-interactive-hover)]",
  );
  expect(messageSource).not.toContain("hover:bg-background/60");
});

test("审批嵌在工作卡 footer 内，不再是兄弟 .bui-approval", () => {
  const cardAt = messageSource.indexOf("<ToolProgressCard");
  expect(cardAt).toBeGreaterThan(-1);
  const footerAt = messageSource.indexOf("footer={", cardAt);
  const approvalAt = messageSource.indexOf("ASSISTANT_APPROVAL_PARTS", cardAt);
  const cardEndAt = messageSource.indexOf("</ToolProgressCard>", cardAt);
  expect(footerAt).toBeGreaterThan(cardAt);
  expect(approvalAt).toBeGreaterThan(footerAt);
  expect(approvalAt).toBeLessThan(cardEndAt);
  // 正文作为 children 进纸，artifact 留在纸外
  const textAt = messageSource.indexOf("ASSISTANT_TEXT_PARTS", cardAt);
  expect(textAt).toBeGreaterThan(cardAt);
  expect(textAt).toBeLessThan(cardEndAt);
  const artifactAt = messageSource.indexOf("ASSISTANT_ARTIFACT_PARTS", cardEndAt);
  expect(artifactAt).toBeGreaterThan(cardEndAt);
  // 审批 map 只渲 executeBatchPlan，其余 part 为 null，避免双渲染
  const approvalMapAt = messageSource.indexOf("ASSISTANT_APPROVAL_PARTS = {");
  expect(approvalMapAt).toBeGreaterThan(-1);
});

test("纯问答消息不传 footer，空审批不再占 22px", () => {
  const cardAt = messageSource.indexOf("<ToolProgressCard");
  expect(cardAt).toBeGreaterThan(-1);
  const cardEndAt = messageSource.indexOf("</ToolProgressCard>", cardAt);
  const footerBlock = messageSource.slice(cardAt, cardEndAt);
  // 有可见 executeBatchPlan 审批时才传 footer，否则为 undefined（不渲染空 .notebook-ai-work-footer）
  expect(footerBlock).toContain("hasVisibleApprovalPart(progressToolParts");
  expect(footerBlock).toContain(": undefined");
  const helperAt = messageSource.indexOf("function hasVisibleApprovalPart");
  expect(helperAt).toBeGreaterThan(-1);
  const helperBody = messageSource.slice(helperAt, helperAt + 600);
  expect(helperBody).toContain('part.type === "tool-executeBatchPlan"');
  expect(helperBody).toContain("shouldShowToolPart(part, isMessageStreaming)");
  expect(helperBody).toContain('"input-streaming"');
  expect(helperBody).toContain('"input-available"');
});

test("对话列用灰纸，白卡浮起", () => {
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
  expect(buiCss).toMatch(
    /\.notebook-ai-messages[\s\S]{0,200}background:\s*var\(--goose-block-subtle-inset\)/,
  );
  expect(buiCss).not.toMatch(
    /\.notebook-ai-messages[\s\S]{0,200}background:\s*var\(--bui-canvas/,
  );
});

test("提案卡进工作卡 children，复制条仍在卡外", () => {
  expect(messageSource).toContain("BatchPlanProposal");
  const cardAt = messageSource.indexOf("<ToolProgressCard");
  expect(cardAt).toBeGreaterThan(-1);
  const cardEndAt = messageSource.indexOf("</ToolProgressCard>", cardAt);
  const proposalAt = messageSource.indexOf("<BatchPlanProposal", cardAt);
  expect(proposalAt).toBeGreaterThan(cardAt);
  expect(proposalAt).toBeLessThan(cardEndAt);
  // 提案在 text parts 之后、footer 之外
  const textAt = messageSource.indexOf("ASSISTANT_TEXT_PARTS", cardAt);
  expect(textAt).toBeGreaterThan(cardAt);
  expect(textAt).toBeLessThan(proposalAt);
  const footerAt = messageSource.indexOf("footer={", cardAt);
  expect(footerAt).toBeGreaterThan(cardAt);
  expect(footerAt).toBeLessThan(proposalAt);
  // 复制条（消息操作栏）仍在卡外
  const actionsAt = messageSource.indexOf("<MessageActionBar />", cardEndAt);
  expect(actionsAt).toBeGreaterThan(cardEndAt);
});

test("纯问答路径不渲染提案，提案跟 hasVisibleApprovalPart 走", () => {
  const cardAt = messageSource.indexOf("<ToolProgressCard");
  expect(cardAt).toBeGreaterThan(-1);
  const cardEndAt = messageSource.indexOf("</ToolProgressCard>", cardAt);
  const cardBlock = messageSource.slice(cardAt, cardEndAt);
  // 提案与 footer 同样以 hasVisibleApprovalPart 为条件，不无条件渲染
  const proposalAt = cardBlock.indexOf("<BatchPlanProposal");
  expect(proposalAt).toBeGreaterThan(-1);
  const gateAt = cardBlock.lastIndexOf("hasVisibleApprovalPart", proposalAt);
  expect(gateAt).toBeGreaterThan(-1);
});

test("工作卡与审批卡共用纸面，步骤图标锁 14px、不套任务卡", () => {
  const cardSource = readFileSync(
    "src/pages/workspace/components/notebook-ai/ToolProgressCard.tsx",
    "utf8",
  );
  expect(notebookAiCss).toContain(".notebook-ai-work-card");
  expect(notebookAiCss).toContain("width: 14px");
  expect(notebookAiCss).toContain("padding: 22px 20px 16px");
  expect(notebookAiCss).toContain("margin: 10px 0 2px");
  expect(notebookAiCss).not.toContain("padding-left: 42px");
  expect(notebookAiCss).not.toContain("margin: 10px 0 2px -22px");
  expect(notebookAiCss).toContain("min-height: 32px");
  expect(notebookAiCss).toMatch(
    /\.notebook-ai-work-toggle\[aria-expanded="true"\] \.notebook-ai-work-chev \{[\s\S]{0,80}transform:\s*rotate\(90deg\)/,
  );
  expect(notebookAiCss).not.toContain("grid-template-rows: 0fr");
  expect(cardSource).toContain('width="14"');
  expect(cardSource).toContain('d="m9 18 6-6-6-6"');
  expect(cardSource).not.toContain('d="m6 9 6 6 6-6"');
  expect(cardSource).not.toContain("TaskRows");
  // 有 children/footer 时即使无步骤也出纸；纯空卡才返回 null
  expect(cardSource).toContain("!hasHeading && !showTraceRow && !children && !footer");
  expect(cardSource).toContain("notebook-ai-work-footer");
  expect(cardSource).toContain("foldable && open");
  expect(cardSource).toContain("useState(false)");
  expect(cardSource).not.toContain("setOpen(true)");
  expect(cardSource).toContain("thinkingText");
  expect(cardSource).toContain("visibleBusyTickerLine");
  expect(cardSource).toContain("notebook-ai-work-think");
  expect(messageSource).toContain("collectReasoningText");
  expect(messageSource).toContain("thinkingText={reasoningText}");
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
  expect(messageSource).not.toContain("AssistantReasoningPart");
  expect(messageSource).toContain("Reasoning: NullMessagePart");
});

test("思考与工具汇总成一行，思考只在行内输出", () => {
  const cardSource = readFileSync(
    "src/pages/workspace/components/notebook-ai/ToolProgressCard.tsx",
    "utf8",
  );
  expect(cardSource).toContain("thinkingText");
  expect(cardSource).toContain("visibleBusyTickerLine");
  expect(cardSource).toContain("notebook-ai-work-think");
  expect(cardSource).toContain('hasThinking ? "思考"');
  expect(messageSource).toContain("thinkingText={reasoningText}");
  expect(notebookAiCss).toContain(".notebook-ai-work-think");
  expect(notebookAiCss).toContain("white-space: nowrap");
});

test("有变更计划时思考默认折叠，正文让给整页改动", () => {
  expect(messageSource).toContain("AssistantLetterFold");
  expect(messageSource).toContain("notebook-ai-letter-fold");
  expect(messageSource).toContain("<span>思考</span>");
  expect(messageSource).toContain("visibleApprovalPart &&");
  expect(notebookAiCss).toContain(".notebook-ai-letter-fold-toggle");
  expect(notebookAiCss).toContain(
    '.notebook-ai-letter-fold-toggle[aria-expanded="true"] .notebook-ai-letter-chev',
  );
});
