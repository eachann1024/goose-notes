import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";

const buiCss = readFileSync(
  new URL("../../src/pages/workspace/styles/beautiful-ui.css", import.meta.url),
  "utf8",
);
const notebookAiCss = readFileSync(
  new URL("../../src/pages/workspace/styles/notebook-ai.css", import.meta.url),
  "utf8",
);
const approvalCard = readFileSync(
  new URL(
    "../../src/pages/workspace/components/notebook-ai/beautiful-ui/ApprovalCard.tsx",
    import.meta.url,
  ),
  "utf8",
);
const approvalPlanCard = readFileSync(
  new URL(
    "../../src/pages/workspace/components/notebook-ai/ApprovalPlanCard.tsx",
    import.meta.url,
  ),
  "utf8",
);

function getRule(css: string, selector: string): string {
  const selectorIndex = css.indexOf(`${selector} {`);
  if (selectorIndex < 0) return "";
  const bodyStart = css.indexOf("{", selectorIndex) + 1;
  const bodyEnd = css.indexOf("}", bodyStart);
  return css.slice(bodyStart, bodyEnd);
}

test("审批卡用 goose 面板色，不回退纯白底", () => {
  const approval = getRule(buiCss, ".bui-approval");
  expect(approval).toContain("hsl(var(--goose-editor-bg))");
  expect(approval).toContain("hsl(var(--foreground))");
  expect(approval).toContain("border-radius: 20px");
  expect(approval).not.toMatch(/background:\s*var\(--bui-surface,\s*#ffffff\)/);
  expect(approval).not.toMatch(/background:\s*#fff(fff)?\b/i);

  const scoped = getRule(
    notebookAiCss,
    ".notebook-ai-approval-plan.bui-approval",
  );
  expect(scoped).toContain("hsl(var(--goose-editor-bg))");
  expect(scoped).not.toMatch(/#fff(fff)?\b/i);
});

test("审批卡徽章和次按钮有前景色 token", () => {
  expect(approvalCard).toContain("bui-root");
  expect(approvalCard).toContain("text-foreground");
  expect(approvalCard).not.toContain("#e4e4e8");
  expect(approvalPlanCard).toContain("text-foreground");
  expect(approvalPlanCard).toContain("--goose-block-subtle-bg");
});

test("用户气泡跟审批卡同一张纸", () => {
  const bubble = getRule(notebookAiCss, ".notebook-ai-user-bubble");
  expect(bubble).toContain("hsl(var(--goose-editor-bg))");
  expect(bubble).toContain("0 8px 22px");
  expect(notebookAiCss).not.toContain("bg-[#58d7b8]/12");
});

test("消息里的 @ 引用跟随强调色", () => {
  const mention = getRule(
    notebookAiCss,
    ".notebook-ai-message-inline .ai-composer-chip[data-ai-mention-chip]",
  );
  expect(mention).toContain("var(--goose-interactive-selected)");
  expect(mention).toContain("var(--goose-interactive-selected-fg)");
  expect(mention).toContain("var(--goose-inline-code-border-hover)");
  expect(mention).not.toContain("99, 102, 241");
});

test("审批卡用整页计划文档展示全部改动，不用截断灰盒", () => {
  expect(approvalPlanCard).toContain("同意");
  expect(approvalPlanCard).toContain(
    "selectedOperationIds: approved ? operationIds : []",
  );
  expect(approvalPlanCard).toContain("grid-cols-[1fr_1.2fr]");
  expect(approvalPlanCard).not.toContain("点同意后会写入笔记。");
  expect(approvalPlanCard).not.toContain("operationHint");
  expect(approvalPlanCard).not.toContain("DiffTable");
  expect(approvalPlanCard).not.toContain("expandedIds");
  expect(approvalPlanCard).not.toContain("notebook-ai-plan-checkbox");
  expect(approvalPlanCard).not.toContain("展开");
  expect(notebookAiCss).not.toContain(".notebook-ai-plan-checkbox");
  expect(approvalPlanCard).toContain("BatchPlanProposal");
  expect(approvalPlanCard).toContain("notebook-ai-work-proposal");
  expect(approvalPlanCard).toContain("notebook-ai-plan-file");
  expect(approvalPlanCard).toContain("PlanMarkdown");
  expect(approvalPlanCard).not.toContain("truncateText");
  expect(approvalPlanCard).not.toContain("slice(0, 3)");
  expect(approvalPlanCard).toContain("h-[40px]");
  expect(approvalPlanCard).toContain("text-[14px]");
  expect(approvalPlanCard).not.toContain("h-11");
  expect(approvalPlanCard).not.toContain("text-[15px]");
  const proposal = getRule(notebookAiCss, ".notebook-ai-work-proposal");
  expect(proposal).toContain("border-radius: 12px");
  expect(proposal).toContain("--goose-block-subtle-bg");
  expect(notebookAiCss).toContain(".notebook-ai-plan-md");
  expect(notebookAiCss).toContain("var(--editor-font-size, 16px)");
  expect(approvalCard).not.toContain("border-b");
  expect(approvalCard).not.toContain("border-t");
  expect(approvalCard).toContain("text-[20px]");
});

test("embedded 模式只输出 footer 内容，不套 .bui-approval 外壳、不重复包 work-footer", () => {
  const embeddedMatch = approvalPlanCard.match(
    /if \(embedded\) \{[\s\S]*?\n  \}/,
  );
  expect(embeddedMatch).not.toBeNull();
  const embeddedBranch = embeddedMatch?.[0] ?? "";
  expect(embeddedBranch).toContain("{footer}");
  expect(embeddedBranch).not.toContain("notebook-ai-work-footer");
  expect(embeddedBranch).not.toContain("ApprovalCard");
  expect(embeddedBranch).not.toContain("bui-approval");
  expect(embeddedBranch).not.toContain("notebook-ai-approval-plan");
  expect(embeddedBranch).not.toContain("statusLabel");
  expect(approvalPlanCard).toContain("embedded = false");
});
