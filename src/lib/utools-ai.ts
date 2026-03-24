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
  return Array.isArray(models) ? models : [];
}
