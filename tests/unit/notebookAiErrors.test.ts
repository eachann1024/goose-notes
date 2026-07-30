import { expect, test } from "@playwright/test";
import {
  formatNotebookAiError,
  isNotebookAiBatchPlanSchemaError,
  NOTEBOOK_AI_BATCH_PLAN_BUSINESS_ERROR,
  NOTEBOOK_AI_BATCH_PLAN_SCHEMA_ERROR,
} from "../../src/lib/notebook-ai/errors";
import { getToolProgressStepStatus } from "../../src/pages/workspace/components/notebook-ai/ToolProgressCard";

test.describe("notebook AI error mapping", () => {
  test("脱敏批量计划 schema 错误，不暴露 payload", () => {
    const raw = "Invalid tool call: ZodError pageId=secret markdown=正文";
    expect(isNotebookAiBatchPlanSchemaError(raw)).toBe(true);
    expect(formatNotebookAiError(raw, { phase: "prepare" })).toBe(
      NOTEBOOK_AI_BATCH_PLAN_SCHEMA_ERROR,
    );
    expect(formatNotebookAiError(raw, { phase: "prepare" })).not.toContain(
      "secret",
    );
  });

  test("映射网络错误", () => {
    expect(formatNotebookAiError(new Error("Failed to fetch"))).toContain(
      "无法连接 AI 服务",
    );
  });

  test("普通 pageId、markdown、payload 和 stack 不会泄露", () => {
    const raw = "pageId=secret markdown=正文 payload={x:1}\\n at secret.ts:1";
    const result = formatNotebookAiError(raw);
    expect(result).not.toContain("secret");
    expect(result).not.toContain("markdown");
    expect(result).not.toContain("payload");
    expect(result).not.toContain("secret.ts");
  });

  test("区分业务冻结和 schema 错误", () => {
    expect(
      formatNotebookAiError("父级不存在或不属于当前笔记本", {
        phase: "prepare",
      }),
    ).toContain("父级不可用");
    expect(
      formatNotebookAiError("ZodError: invalid tool arguments", {
        phase: "prepare",
      }),
    ).toBe(NOTEBOOK_AI_BATCH_PLAN_SCHEMA_ERROR);
    expect(formatNotebookAiError("父级不存在", { phase: "prepare" })).not.toBe(
      NOTEBOOK_AI_BATCH_PLAN_SCHEMA_ERROR,
    );
    expect(NOTEBOOK_AI_BATCH_PLAN_BUSINESS_ERROR).toContain("0 项");
  });

  test("撤回异常使用固定安全文案", () => {
    const result = formatNotebookAiError(
      new Error("pageId=secret stack payload"),
      {
        phase: "undo",
      },
    );
    expect(result).toContain("撤回失败");
    expect(result).not.toContain("secret");
  });

  test("审批后的 output-error 不声称零写入", () => {
    const result = formatNotebookAiError("executor failed pageId=secret", {
      phase: "execute",
    });
    expect(result).toContain("执行未完成");
    expect(result).not.toContain("0 项");
    expect(result).not.toContain("没有写入");
  });

  test("审批后的 output.ok=false 不声称零写入，审批前仍可明确零写入", () => {
    const executed = formatNotebookAiError("executor returned ok=false", {
      phase: "execute",
    });
    const prepared = formatNotebookAiError("invalid tool arguments", {
      phase: "prepare",
    });
    expect(executed).toContain("执行未完成");
    expect(executed).not.toContain("0 项");
    expect(executed).not.toContain("没有写入");
    expect(prepared).toContain("0 项");
    expect(prepared).toContain("没有写入");
    expect(
      getToolProgressStepStatus({
        type: "tool-executeBatchPlan",
        state: "output-available",
        output: { ok: false },
      }),
    ).toBe("error");
  });

  test("超长普通错误使用固定可恢复文案", () => {
    const result = formatNotebookAiError("x".repeat(500));
    expect(result).toBe("本轮请求失败，请稍后重试。");
  });

  test("空错误使用可恢复文案", () => {
    expect(formatNotebookAiError(null)).toBe("本轮请求失败，请稍后重试。");
  });
});
