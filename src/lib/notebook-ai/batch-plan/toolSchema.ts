import { z } from "zod";

const optionalOperationId = z
  .string()
  .min(1)
  .optional()
  .describe("可选的操作唯一标识；省略时由应用自动生成");

const canonicalOperationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("create"),
      operationId: optionalOperationId,
      title: z.string().min(1),
      markdown: z.string().min(1),
      parentId: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("edit"),
      operationId: optionalOperationId,
      pageId: z.string().min(1),
      markdown: z.string().min(1),
      title: z.string().min(1).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("delete"),
      operationId: optionalOperationId,
      pageIds: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("search_replace"),
      operationId: optionalOperationId,
      pageId: z.string().min(1),
      oldString: z.string().min(1),
      /** 可为空字符串，表示删除匹配片段。 */
      newString: z.string(),
      replaceAll: z.boolean().optional(),
    })
    .strict(),
]);

/** 模型可见的唯一工具契约；旧格式只在 repair hook 内部兼容。 */
export const executeBatchPlanInputSchema = z
  .object({
    runId: z.string().min(1).optional(),
    title: z.string().min(1),
    summary: z.string().min(1),
    operations: z.array(canonicalOperationSchema).min(1).max(50),
  })
  .strict();

type CanonicalOperation = z.infer<typeof canonicalOperationSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalType(value: unknown) {
  switch (value) {
    case "create":
    case "create_page":
    case "createPage":
      return "create" as const;
    case "edit":
    case "edit_page":
    case "editPage":
      return "edit" as const;
    case "delete":
    case "delete_page":
    case "deletePage":
      return "delete" as const;
    case "search_replace":
    case "searchReplace":
    case "str_replace":
    case "strReplace":
    case "replace_in_page":
    case "replaceInPage":
      return "search_replace" as const;
    default:
      return null;
  }
}

function parseChanges(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function repairOperation(value: unknown): CanonicalOperation | null {
  if (!isRecord(value)) return null;
  const fromType = value.type === undefined ? null : canonicalType(value.type);
  const fromAction =
    value.action === undefined ? null : canonicalType(value.action);
  if (
    (value.type !== undefined && !fromType) ||
    (value.action !== undefined && !fromAction) ||
    (!fromType && !fromAction) ||
    (fromType && fromAction && fromType !== fromAction)
  ) {
    return null;
  }
  const type = fromType ?? fromAction;
  if (!type) return null;

  const operationId =
    typeof value.operationId === "string" ? value.operationId : undefined;
  if (type === "create") {
    return {
      type,
      ...(operationId ? { operationId } : {}),
      title: value.title as string,
      markdown: value.markdown as string,
      ...(typeof value.parentId === "string"
        ? { parentId: value.parentId }
        : {}),
    };
  }
  if (type === "edit") {
    return {
      type,
      ...(operationId ? { operationId } : {}),
      pageId: value.pageId as string,
      markdown: value.markdown as string,
      ...(typeof value.title === "string" ? { title: value.title } : {}),
    };
  }
  if (type === "search_replace") {
    const oldString =
      typeof value.oldString === "string"
        ? value.oldString
        : typeof value.old_string === "string"
          ? value.old_string
          : typeof value.find === "string"
            ? value.find
            : typeof value.search === "string"
              ? value.search
              : undefined;
    const newString =
      typeof value.newString === "string"
        ? value.newString
        : typeof value.new_string === "string"
          ? value.new_string
          : typeof value.replace === "string"
            ? value.replace
            : typeof value.replacement === "string"
              ? value.replacement
              : undefined;
    const replaceAllRaw = value.replaceAll ?? value.replace_all;
    const replaceAll =
      typeof replaceAllRaw === "boolean" ? replaceAllRaw : undefined;
    if (oldString === undefined || newString === undefined) return null;
    return {
      type,
      ...(operationId ? { operationId } : {}),
      pageId: value.pageId as string,
      oldString,
      newString,
      ...(replaceAll !== undefined ? { replaceAll } : {}),
    };
  }

  const pageIds = Array.isArray(value.pageIds)
    ? value.pageIds
    : typeof value.pageId === "string"
      ? [value.pageId]
      : value.pageIds;
  return {
    type,
    ...(operationId ? { operationId } : {}),
    pageIds: pageIds as string[],
  };
}

/**
 * 只修复可证明等价的旧批量计划。不会从 Markdown/XML/空内容推断写入操作。
 */
export function repairExecuteBatchPlanInput(input: string): string | null {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;

  const plan = isRecord(value.plan) ? value.plan : null;
  const source = value.changes !== undefined ? value : plan;
  if (!source || source.changes === undefined) return null;
  const changes = parseChanges(source.changes);
  if (!changes || changes.length === 0) return null;

  const operations = changes.map(repairOperation);
  if (operations.some((operation) => !operation)) return null;
  const candidate = {
    ...(typeof (source.runId ?? value.runId) === "string"
      ? { runId: source.runId ?? value.runId }
      : {}),
    title: source.title ?? value.title,
    summary: source.summary ?? value.summary,
    operations,
  };
  const parsed = executeBatchPlanInputSchema.safeParse(candidate);
  return parsed.success ? JSON.stringify(parsed.data) : null;
}
