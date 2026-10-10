export function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function truncate(text: string, max = 28) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export const SKILL_LABELS: Record<string, string> = {
  createNoote: "新建笔记",
  updateNote: "修改笔记",
  deleteNote: "删除笔记",
  searchNotes: "搜索笔记",
  chat: "对话",
  visual: "可视化",
  webResearch: "网页研究",
};
