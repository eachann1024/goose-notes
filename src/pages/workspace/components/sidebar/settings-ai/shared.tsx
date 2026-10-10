import { type ComponentType } from "react";
import * as GooseIcons from "@/components/ui/icons";
import {
  DEFAULT_CLAUDE_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  getProviderFixedBaseURL,
  type AIModelOption,
  type AIProviderId,
  type CustomAIProtocol,
} from "@/lib/ai-provider";
import { type SetupGuideAIStatus } from "@/lib/setupGuideAI";
import type { AISettings } from "@/stores/useSettings";
import { cn } from "@/lib/utils";

export interface SettingsAIProps {
  visible?: boolean;
  mode?: "settings" | "onboarding";
  onSetupStateChange?: (status: SetupGuideAIStatus) => void;
  ai: AISettings;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  setReadGlobalPrompt: (enabled: boolean) => void;
  setReadLocalSkills: (enabled: boolean) => void;
  selectedModelId: string | null;
  setSelectedModelId: (modelId: string | null) => void;
  saveCustomConfig: (config: {
    providerId: AIProviderId;
    protocol?: CustomAIProtocol;
    baseURL: string;
    apiKey: string;
    modelOptions: AIModelOption[];
  }) => void;
}

export const SETTINGS_OPTION_ROW_CLASS =
  "rounded-[12px] bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]";

export const CUSTOM_AI_KEY_HINT =
  "请前往「设置 › AI 助手 › AI 服务」补充 API Key";

export const EMPTY_AI_MODEL_OPTIONS: AIModelOption[] = [];

export /** 供应商菜单图标：与预设文案解耦，避免 presets 依赖 React */
const PROVIDER_ICONS: Record<
  AIProviderId,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  deepseek: GooseIcons.Sparkles,
  glm: GooseIcons.Brain,
  minimax: GooseIcons.AudioLines,
  "custom-openai-responses": GooseIcons.Zap,
  "custom-openai": GooseIcons.Boxes,
  "custom-claude": GooseIcons.MessageSquare,
};

export function ProviderIconTile({
  providerId,
  size = "md",
}: {
  providerId: AIProviderId;
  size?: "sm" | "md";
}) {
  const Icon = PROVIDER_ICONS[providerId] ?? GooseIcons.Server;
  const isSm = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[8px] bg-[var(--goose-block-subtle-bg)] text-muted-foreground",
        isSm ? "h-6 w-6 rounded-[7px]" : "h-8 w-8",
      )}
      aria-hidden
    >
      <Icon className={isSm ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.75} />
    </span>
  );
}

export interface ProviderConnection {
  providerId: AIProviderId;
  protocol: CustomAIProtocol;
  baseURL: string;
  apiKey: string;
}

export function readStoredApiKey(
  ai: AISettings,
  providerId: AIProviderId,
  protocol: CustomAIProtocol,
): string {
  if (providerId === "deepseek") {
    return (
      ai.customOpenAIResponsesApiKey?.trim() ||
      ai.customOpenAIApiKey?.trim() ||
      ""
    );
  }
  if (protocol === "openai-responses")
    return ai.customOpenAIResponsesApiKey || "";
  if (protocol === "openai") return ai.customOpenAIApiKey || "";
  return ai.customClaudeApiKey || "";
}

export function readStoredBaseURL(
  ai: AISettings,
  providerId: AIProviderId,
  protocol: CustomAIProtocol,
): string {
  const fixed = getProviderFixedBaseURL(providerId);
  if (fixed) return fixed;
  if (protocol === "openai-responses") {
    return ai.customOpenAIResponsesBaseURL || DEFAULT_OPENAI_BASE_URL;
  }
  if (protocol === "openai") {
    return ai.customOpenAIBaseURL || DEFAULT_OPENAI_BASE_URL;
  }
  return ai.customClaudeBaseURL || DEFAULT_CLAUDE_BASE_URL;
}
