import type {
  AiComposerPayload,
  AiComposerToken,
  AiFileReferenceAttrs,
  AiReferenceOccurrence,
  AiReferenceRole,
  NormalizedAiComposerPayload,
} from "./referenceTypes";

const TARGET_CUE_PATTERN =
  /(生成到|写到|写入到|写进|放到|放进|保存到|同步到|输出到|替换到|覆盖到|改写到|更新到|汇总到|合并到|追加到|删除|移除|重命名|改名)/i;
const TARGET_PREFIX_PATTERN = /(删除|移除|重命名|改名)$/i;
const CONTEXT_CUE_PATTERN =
  /(参考|参照|结合|基于|根据|对照|引用|读取|查看|分析|汇总)/i;

function collectReferenceNeighborText(
  tokens: AiComposerToken[],
  index: number,
  direction: "before" | "after",
  maxLength = 24,
) {
  let remaining = maxLength;
  let cursor = direction === "before" ? index - 1 : index + 1;
  const parts: string[] = [];
  while (cursor >= 0 && cursor < tokens.length && remaining > 0) {
    const token = tokens[cursor];
    // 只看与当前引用直接相邻的文本，不能越过另一个引用或图片，
    // 否则“@A @B 汇总到 @C”会把 A/B 误判成目标。
    if (token.type !== "text") break;
    const text = token.text;
    const slice =
      direction === "before"
        ? text.slice(Math.max(0, text.length - remaining))
        : text.slice(0, remaining);
    if (direction === "before") parts.unshift(slice);
    else parts.push(slice);
    remaining -= slice.length;
    cursor += direction === "before" ? -1 : 1;
  }
  return parts.join("").replace(/\s+/g, "");
}

export function inferAiReferenceRole(
  tokens: AiComposerToken[],
  tokenIndex: number,
): Pick<AiReferenceOccurrence, "role" | "roleSource"> {
  const token = tokens[tokenIndex];
  if (token?.type !== "reference") {
    return { role: "context", roleSource: "default" };
  }
  const explicitRole = token.role ?? token.reference.role;
  if (explicitRole) return { role: explicitRole, roleSource: "explicit" };
  const before = collectReferenceNeighborText(tokens, tokenIndex, "before");
  const after = collectReferenceNeighborText(tokens, tokenIndex, "after");
  if (TARGET_CUE_PATTERN.test(before) || TARGET_PREFIX_PATTERN.test(after)) {
    return { role: "target", roleSource: "inferred" };
  }
  if (CONTEXT_CUE_PATTERN.test(before) || CONTEXT_CUE_PATTERN.test(after)) {
    return { role: "context", roleSource: "inferred" };
  }
  return { role: "context", roleSource: "default" };
}

/**
 * 规范化 composer payload：资源按 pageId 唯一，出现记录仍完整保序。
 * 不修改传入对象，避免调用方之间共享可变 references 数组。
 */
export function normalizeAiComposerPayload(
  input: AiComposerPayload,
): NormalizedAiComposerPayload {
  const resources: AiFileReferenceAttrs[] = [];
  const resourceMap = new Map<string, AiFileReferenceAttrs>();
  const occurrences: AiReferenceOccurrence[] = [];

  input.tokens.forEach((token, tokenIndex) => {
    if (token.type !== "reference" || !token.reference.pageId) return;
    const { role, roleSource } = inferAiReferenceRole(input.tokens, tokenIndex);
    if (!resourceMap.has(token.reference.pageId)) {
      const resource = { ...token.reference };
      delete resource.role;
      resourceMap.set(token.reference.pageId, resource);
      resources.push(resource);
    }
    occurrences.push({
      occurrenceId: `${token.reference.pageId}:${tokenIndex}`,
      tokenIndex,
      pageId: token.reference.pageId,
      role,
      roleSource,
    });
  });

  // 兼容旧 payload：tokens 为空或缺失引用 token 时仍消费 references。
  input.references.forEach((reference) => {
    if (!reference.pageId || resourceMap.has(reference.pageId)) return;
    const resource = { ...reference };
    delete resource.role;
    resourceMap.set(reference.pageId, resource);
    resources.push(resource);
    occurrences.push({
      occurrenceId: `${reference.pageId}:legacy-${occurrences.length}`,
      tokenIndex: -1,
      pageId: reference.pageId,
      role: reference.role ?? "context",
      roleSource: reference.role ? "explicit" : "default",
    });
  });

  const rolesByPage = new Map<string, Set<AiReferenceRole>>();
  occurrences.forEach((occurrence) => {
    const roles =
      rolesByPage.get(occurrence.pageId) ?? new Set<AiReferenceRole>();
    roles.add(occurrence.role);
    rolesByPage.set(occurrence.pageId, roles);
  });
  const contextReferences = resources.filter((reference) => {
    const pageOccurrences = occurrences.filter(
      (occurrence) => occurrence.pageId === reference.pageId,
    );
    // 同一资源同时作为参考和目标时只解析一次，但仍作为读取上下文。
    // 纯目标资源不读取正文，避免无意义的 token 消耗。
    return pageOccurrences.some((occurrence) => occurrence.role === "context");
  });
  const targetReferences = resources.filter((reference) =>
    occurrences.some(
      (occurrence) =>
        occurrence.pageId === reference.pageId && occurrence.role === "target",
    ),
  );

  return {
    payload: { ...input, references: resources },
    resources,
    occurrences,
    contextReferences,
    targetReferences,
    hasRoleConflict: [...rolesByPage.values()].some((roles) => roles.size > 1),
  };
}
