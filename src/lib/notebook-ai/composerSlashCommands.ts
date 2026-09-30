import type { LocalSkill } from "./localContext";
import { searchLocalSkills } from "./localContext";
import type { AiComposerPayload } from "@/components/editor/ai/composer/referenceLookup";

export type ComposerSlashBuiltinId = "new" | "compact";

export interface ComposerSlashBuiltin {
  kind: "builtin";
  id: ComposerSlashBuiltinId;
  /** 菜单展示名（不含 /） */
  name: string;
  aliases: string[];
  description: string;
}

export type ComposerSlashItem =
  | ComposerSlashBuiltin
  | { kind: "skill"; skill: LocalSkill };

export const COMPOSER_SLASH_BUILTINS: readonly ComposerSlashBuiltin[] = [
  {
    kind: "builtin",
    id: "new",
    name: "新会话",
    aliases: ["new", "新会话"],
    description: "开启空白对话，当前会话会留在历史里",
  },
  {
    kind: "builtin",
    id: "compact",
    name: "压缩",
    aliases: ["compact", "压缩"],
    description: "把当前对话压成摘要，腾出上下文空间",
  },
];

function normalizeSlashQuery(value: string): string {
  return value.trim().toLowerCase();
}

function builtinMatchesQuery(
  command: ComposerSlashBuiltin,
  query: string,
): boolean {
  if (!query) return true;
  if (command.name.toLowerCase().includes(query)) return true;
  if (command.description.toLowerCase().includes(query)) return true;
  return command.aliases.some((alias) => alias.toLowerCase().includes(query));
}

export function searchComposerSlashItems(
  query: string,
  options?: { notebookId?: string; includeSkills?: boolean },
): ComposerSlashItem[] {
  const normalized = normalizeSlashQuery(query);
  const builtins = COMPOSER_SLASH_BUILTINS.filter((command) =>
    builtinMatchesQuery(command, normalized),
  );
  const skills = options?.includeSkills
    ? searchLocalSkills(query, options.notebookId).map(
        (skill): ComposerSlashItem => ({ kind: "skill", skill }),
      )
    : [];
  return [...builtins, ...skills];
}

export function slashItemKey(item: ComposerSlashItem): string {
  return item.kind === "builtin" ? `builtin:${item.id}` : item.skill.path;
}

export function slashItemTitle(item: ComposerSlashItem): string {
  return item.kind === "builtin" ? `/${item.name}` : item.skill.name;
}

export function slashItemDescription(item: ComposerSlashItem): string {
  return item.kind === "builtin" ? item.description : item.skill.description;
}

/** 整段输入恰好是一条内置指令（允许首尾空白，必须带 /） */
export function matchExactComposerSlashCommand(
  text: string,
): ComposerSlashBuiltinId | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const body = trimmed.slice(1);
  const normalized = normalizeSlashQuery(body);
  if (!normalized || /[\s\n]/.test(body)) return null;
  for (const command of COMPOSER_SLASH_BUILTINS) {
    if (command.name.toLowerCase() === normalized) return command.id;
    if (command.aliases.some((alias) => alias.toLowerCase() === normalized)) {
      return command.id;
    }
  }
  return null;
}

/** 输入框里只有这条指令、没有引用/图片/Skill chip 时才当作发送拦截 */
export function matchComposerPayloadSlashCommand(
  payload: Pick<
    AiComposerPayload,
    "promptText" | "references" | "images" | "skills" | "selectionQuotes"
  >,
): ComposerSlashBuiltinId | null {
  if (
    payload.references.length > 0 ||
    payload.images.length > 0 ||
    payload.skills.length > 0 ||
    (payload.selectionQuotes?.length ?? 0) > 0
  ) {
    return null;
  }
  return matchExactComposerSlashCommand(payload.promptText);
}
