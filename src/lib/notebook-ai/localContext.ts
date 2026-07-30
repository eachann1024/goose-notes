const MAX_GLOBAL_PROMPT_CHARACTERS = 24_000;
const MAX_LOCAL_SKILL_CHARACTERS = 32_000;

export interface LocalSkill {
  name: string;
  description: string;
  path: string;
  content: string;
}

function frontmatterValue(content: string, key: string) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return "";
  const line = match[1]
    .split("\n")
    .find((item) => item.trimStart().startsWith(`${key}:`));
  return line?.slice(line.indexOf(":") + 1).trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function fallbackSkillName(path: string) {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.at(-2) ?? "skill";
}

function normalizeSkillName(name: string) {
  const normalized = name.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return /^[a-z0-9][a-z0-9-]*$/.test(normalized) ? normalized : "";
}

let cachedSkillFiles: ReturnType<NonNullable<Window["gooseAiContext"]>["listLocalSkills"]> | null = null;
let cachedAt = 0;
const LOCAL_SKILL_CACHE_MS = 3_000;

export function clearLocalSkillsCache() {
  cachedSkillFiles = null;
  cachedAt = 0;
}

export function getLocalSkills(forceRefresh = false): LocalSkill[] {
  const cacheFresh = Date.now() - cachedAt < LOCAL_SKILL_CACHE_MS;
  const files =
    !forceRefresh && cachedSkillFiles && cacheFresh
      ? cachedSkillFiles
      : (window.gooseAiContext?.listLocalSkills?.() ?? []);
  cachedSkillFiles = files;
  cachedAt = Date.now();
  const seenNames = new Set<string>();
  return files
    .map(({ path, content }) => ({
      name: normalizeSkillName(
        frontmatterValue(content, "name") || fallbackSkillName(path),
      ),
      description: frontmatterValue(content, "description") || "本地 Skill",
      path,
      content: content.trim().slice(0, MAX_LOCAL_SKILL_CHARACTERS),
    }))
    .filter((skill) => {
      if (!skill.name || seenNames.has(skill.name)) return false;
      seenNames.add(skill.name);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function searchLocalSkills(query: string) {
  const normalized = query.trim().toLowerCase();
  return getLocalSkills()
    .filter(
      (skill) =>
        !normalized ||
        skill.name.toLowerCase().includes(normalized) ||
        skill.description.toLowerCase().includes(normalized),
    )
    .slice(0, 30);
}

export function resolveInvokedLocalSkill(promptText: string) {
  const match = promptText.trimStart().match(/^\/([a-z0-9][a-z0-9-]*)\b/i);
  if (!match) return null;
  return getLocalSkills().find((skill) => skill.name === match[1]) ?? null;
}

export function readGlobalAgentsPrompt() {
  return (
    window.gooseAiContext?.readGlobalPrompt?.()?.trim().slice(
      0,
      MAX_GLOBAL_PROMPT_CHARACTERS,
    ) ?? ""
  );
}
