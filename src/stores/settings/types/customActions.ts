export interface CustomAction {
  id: string;
  name: string;
  pluginName?: string;
  command: string;
  isEnabled: boolean;
}

export const LEGACY_DEFAULT_CUSTOM_ACTION_ID = "default-translate";

export function normalizeCustomActions(
  customActions: CustomAction[] | undefined,
): CustomAction[] {
  if (!Array.isArray(customActions)) {
    return [];
  }

  const normalized = customActions
    .filter((action): action is CustomAction =>
      Boolean(action && typeof action === "object"),
    )
    .map((action, index) => ({
      id:
        typeof action.id === "string" && action.id.trim()
          ? action.id.trim()
          : `custom-action-${Date.now()}-${index}`,
      name: typeof action.name === "string" ? action.name.trim() : "",
      pluginName:
        typeof action.pluginName === "string" && action.pluginName.trim()
          ? action.pluginName.trim()
          : undefined,
      command: typeof action.command === "string" ? action.command.trim() : "",
      isEnabled: Boolean(action.isEnabled),
    }));

  if (
    normalized.length === 1 &&
    normalized[0].id === LEGACY_DEFAULT_CUSTOM_ACTION_ID &&
    normalized[0].name === "跳转到翻译" &&
    normalized[0].command === "翻译" &&
    normalized[0].isEnabled &&
    !normalized[0].pluginName
  ) {
    return [];
  }

  return normalized;
}
