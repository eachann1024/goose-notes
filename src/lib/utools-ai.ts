export interface UToolsAiModel {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  cost?: number;
}

interface UToolsAiApi {
  ai?: (option: unknown) => Promise<unknown>;
  allAiModels?: () => Promise<UToolsAiModel[]>;
}

function getUToolsApi(): UToolsAiApi | null {
  if (typeof window === 'undefined') return null;
  return ((window as Window & { utools?: UToolsAiApi }).utools ?? null);
}

function readStringField(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function readNumberField(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function normalizeUToolsAiModel(input: unknown): UToolsAiModel | null {
  if (!input) return null;

  if (typeof input === "string") {
    const id = input.trim();
    return id ? { id, label: id } : null;
  }

  if (typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const id = readStringField(record, ["id", "model", "name", "value", "key"]);
  if (!id) {
    return null;
  }

  const label = readStringField(record, [
    "label",
    "displayName",
    "display_name",
    "title",
    "name",
    "model",
    "id",
  ]) || id;

  return {
    id,
    label,
    description: readStringField(record, ["description", "desc", "type"]) || undefined,
    icon: readStringField(record, ["icon"]) || undefined,
    cost: readNumberField(record, ["cost", "price"]),
  };
}

export function isUToolsAiSupported() {
  const api = getUToolsApi();
  return Boolean(api?.ai && api?.allAiModels);
}

export async function getAvailableUToolsAiModels() {
  const api = getUToolsApi();
  if (!api?.allAiModels) {
    throw new Error('当前 uTools 版本未提供 AI 模型列表');
  }

  const models = await api.allAiModels();
  if (!Array.isArray(models)) {
    return [];
  }

  const deduped = new Map<string, UToolsAiModel>();
  models.forEach((item) => {
    const normalized = normalizeUToolsAiModel(item);
    if (!normalized) return;
    deduped.set(normalized.id, normalized);
  });

  return Array.from(deduped.values());
}
