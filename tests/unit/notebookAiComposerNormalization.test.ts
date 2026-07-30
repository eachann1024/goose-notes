import { describe, expect, it } from "vitest";
import {
  normalizeAiComposerPayload,
  type AiComposerPayload,
  type AiFileReferenceAttrs,
} from "../../src/components/editor/ai/composer/referenceLookup";
import { resolveAiTargetReference } from "../../src/lib/ai-write/targetResolution";

function reference(pageId: string, role?: "context" | "target"): AiFileReferenceAttrs {
  return {
    pageId,
    workspaceId: "notebook-1",
    titleSnapshot: pageId,
    sourceType: "app-page",
    role,
  };
}

function payload(tokens: AiComposerPayload["tokens"]): AiComposerPayload {
  return {
    promptText: "测试",
    freeformText: "测试",
    references: tokens.flatMap((token) => token.type === "reference" ? [token.reference] : []),
    images: [],
    tokens,
  };
}

describe("normalizeAiComposerPayload", () => {
  it("资源去重但保留同一页面的每次出现和显式角色", () => {
    const input = payload([
      { type: "reference", reference: reference("page-a", "context") },
      { type: "text", text: "汇总到" },
      { type: "reference", reference: reference("page-a", "target") },
    ]);

    const normalized = normalizeAiComposerPayload(input);

    expect(normalized.resources).toHaveLength(1);
    expect(normalized.occurrences.map((item) => item.role)).toEqual([
      "context",
      "target",
    ]);
    expect(normalized.hasRoleConflict).toBe(true);
    expect(normalized.contextReferences).toHaveLength(1);
    expect(normalized.targetReferences).toHaveLength(1);
    expect(input.references).toHaveLength(2);
  });

  it("没有显式角色时按邻近目标动词推断", () => {
    const input = payload([
      { type: "text", text: "请写入到" },
      { type: "reference", reference: reference("page-b") },
    ]);

    const normalized = normalizeAiComposerPayload(input);
    expect(normalized.occurrences[0]).toMatchObject({
      pageId: "page-b",
      role: "target",
      roleSource: "inferred",
    });
  });

  it("显式角色优先于邻近文本", () => {
    const input = payload([
      { type: "text", text: "请写入到" },
      { type: "reference", reference: reference("page-c", "context") },
    ]);

    expect(resolveAiTargetReference(input)).toBeNull();
  });

  it("目标提示不会越过其它引用污染前面的上下文", () => {
    const input = payload([
      { type: "reference", reference: reference("page-a") },
      { type: "text", text: " " },
      { type: "reference", reference: reference("page-b") },
      { type: "text", text: " 汇总到 " },
      { type: "reference", reference: reference("page-c") },
    ]);

    const normalized = normalizeAiComposerPayload(input);
    expect(normalized.occurrences.map((item) => item.role)).toEqual([
      "context",
      "context",
      "target",
    ]);
  });
});
