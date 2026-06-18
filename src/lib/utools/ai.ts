export { isUToolsAiSupported, getAvailableUToolsAiModels } from "@/lib/utools-ai";
export type { UToolsAiModel } from "@/lib/utools-ai";

import { getUToolsApi } from "./env";

export const ai = {
  isSupported: (): boolean => {
    const utools = getUToolsApi();
    return Boolean(utools?.ai && utools?.allAiModels);
  },

  call: async (option: unknown): Promise<unknown> => {
    const utools = getUToolsApi();
    if (!utools?.ai) throw new Error("uTools AI 不可用");
    return utools.ai(option);
  },

  allModels: async (): Promise<unknown[]> => {
    const utools = getUToolsApi();
    if (!utools?.allAiModels) throw new Error("uTools AI 模型列表不可用");
    return utools.allAiModels();
  },
};
