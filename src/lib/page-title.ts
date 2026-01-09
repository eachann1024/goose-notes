import type { Page } from "@/types";
import { extractTitleFromContent } from "./content-text-extractor";

export function getPageTitle(page: Page): string {
  if (page.localFilePath) {
    const name = page.localFilePath.split(/[\\/]/).pop() || "";
    return name || "无标题";
  }

  return extractTitleFromContent(page.content);
}
