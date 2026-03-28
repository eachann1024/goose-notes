export const OPEN_AI_WORKSPACE_EVENT = "goose-note:open-ai-workspace";

export interface OpenAiWorkspaceDetail {
  source?: "header" | "bubble_menu" | "slash_command" | "space" | "empty_state";
}
