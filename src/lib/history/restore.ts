import type { BlockNoteContent } from "@/lib/blocknote-content";
import { historyRepository } from "./repository";

/** 读取某个版本的完整内容。MVP 仅支持 snapshot 版本，直接返回 content。 */
export function materializeVersion(
  pageId: string,
  versionId: string,
): BlockNoteContent | null {
  const version = historyRepository.loadVersion(pageId, versionId);
  return version?.content ?? null;
}
