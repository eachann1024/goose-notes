import type { PartialBlock } from "@blocknote/core";
export type BlockSpecLike = {
  config?: {
    content?: string;
    propSchema?: Record<string, PropSpecLike>;
  };
};

type EditorSchemaLike = {
  blockSpecs?: Record<string, BlockSpecLike>;
};

type PropSpecLike = {
  default?: boolean | number | string;
  type?: "boolean" | "number" | "string";
  values?: readonly unknown[];
};

export function getBlockSpecs(schema: unknown): Record<string, BlockSpecLike> {
  const specs = (schema as EditorSchemaLike | undefined)?.blockSpecs;
  return specs && typeof specs === "object" ? specs : {};
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizePropValue(
  value: unknown,
  spec: PropSpecLike,
): boolean | number | string | undefined {
  const valueType = spec.type ?? typeof spec.default;
  let next: boolean | number | string | undefined;

  if (valueType === "boolean") {
    if (typeof value === "boolean") {
      next = value;
    } else if (value === "true") {
      next = true;
    } else if (value === "false") {
      next = false;
    }
  } else if (valueType === "number") {
    const numberValue = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numberValue)) next = numberValue;
  } else if (valueType === "string") {
    if (typeof value === "string") {
      next = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      next = String(value);
    }
  }

  if (next === undefined) return undefined;

  if (Array.isArray(spec.values) && spec.values.length > 0) {
    return spec.values.includes(next) ? next : spec.default;
  }

  return next;
}

export function sanitizeProps(
  type: string,
  props: unknown,
  spec: BlockSpecLike | undefined,
): PartialBlock["props"] | undefined {
  if (!isPlainObject(props)) return undefined;

  const propSchema = spec?.config?.propSchema;
  const allowedKeys =
    propSchema && typeof propSchema === "object"
      ? new Set(Object.keys(propSchema))
      : null;
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (allowedKeys && !allowedKeys.has(key)) continue;
    if (value == null) continue;
    const propSpec = propSchema?.[key];
    if (!propSpec) {
      next[key] = value;
      continue;
    }
    const sanitized = sanitizePropValue(value, propSpec);
    if (sanitized !== undefined) next[key] = sanitized;
  }

  if (type === "heading") {
    const level = Number(next.level);
    next.level = Number.isFinite(level) ? Math.min(Math.max(level, 1), 3) : 1;
  }

  return Object.keys(next).length > 0
    ? (next as PartialBlock["props"])
    : undefined;
}

export function sanitizeTableCellProps(
  props: unknown,
): Record<string, unknown> | undefined {
  if (!isPlainObject(props)) return undefined;
  const next: Record<string, unknown> = {};
  for (const key of ["backgroundColor", "textColor", "textAlignment"]) {
    const value = props[key];
    if (typeof value === "string") next[key] = value;
  }
  for (const key of ["colspan", "rowspan"]) {
    const value = Number(props[key]);
    if (Number.isFinite(value) && value > 0) next[key] = Math.floor(value);
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
