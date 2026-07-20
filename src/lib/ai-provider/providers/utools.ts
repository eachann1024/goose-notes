import type { AISettingsLike, AIMessage, AIStreamPhase, AIRequestOverrides } from "../types";
import { getUToolsApi, resolveUToolsModelId } from "../modelCatalog";

export async function handleUToolsStream(
  settings: AISettingsLike,
  messages: AIMessage[],
  signal: AbortSignal,
  emit: (phase: AIStreamPhase, text: string, isReasoning: boolean) => void,
  requestOverrides?: AIRequestOverrides,
) {
  const modelId = await resolveUToolsModelId(settings, requestOverrides);
  const utools = getUToolsApi();
  const utoolsAi = utools?.ai;
  if (!utoolsAi) throw new Error("当前 uTools 环境未提供 AI 方法");

  let fullText = "";
  let fullReasoning = "";

  return new Promise<{ text: string; reasoningText: string }>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let internalHandler: any = null;

    const onAbort = () => {
      internalHandler?.abort?.();
      reject(new DOMException("The operation was aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callPromise = utoolsAi({ model: modelId, messages: messages as any }, (chunk: any) => {
      if (signal.aborted) return;
      if (chunk.reasoning_content) {
        fullReasoning += chunk.reasoning_content;
        emit("thinking", chunk.reasoning_content, true);
      }
      if (chunk.content) {
        fullText += chunk.content;
        emit("generating", chunk.content, false);
      }
    });

    internalHandler = callPromise;

    callPromise
      .then((res) => {
        signal.removeEventListener("abort", onAbort);
        if (!fullText && res?.content) {
          emit("generating", res.content, false);
          fullText = res.content;
        }
        if (!fullReasoning && res?.reasoning_content) {
          emit("thinking", res.reasoning_content, true);
          fullReasoning = res.reasoning_content;
        }
        resolve({ text: fullText, reasoningText: fullReasoning });
      })
      .catch((err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      });
  });
}
