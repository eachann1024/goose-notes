import { readFileSync } from "node:fs";
import { expect, test } from "playwright/test";
import { isPinyinQuery, pinyinMatchIndices } from "../../src/lib/pinyin-search";

test("命令搜索 trim 后仅纯字母查询进入拼音补充", () => {
  for (const query of ["中文", "123", "shu1", "shu ju", "shu-ju", "", "   "]) {
    expect(isPinyinQuery(query.trim()), query).toBe(false);
    expect(pinyinMatchIndices("数据中台", query.trim()), query).toBeNull();
  }
  for (const query of ["shu", "sjzt", " SHU "]) {
    expect(isPinyinQuery(query.trim()), query).toBe(true);
    expect(pinyinMatchIndices("数据中台", query.trim()), query).not.toBeNull();
  }
});

test("拼音门禁包住整个候选循环并保留索引去重及匹配参数", () => {
  // ponytail: 此处仅检查源码接线；需要实际调用计数时再补 Hook 运行时测试。
  const source = readFileSync(
    new URL("../../src/pages/workspace/components/command/useCommandSearch.ts", import.meta.url),
    "utf8",
  );
  const compact = (text: string) => text.replace(/\s+/g, " ").trim();
  expect(source).toContain('import { isPinyinQuery, pinyinMatchIndices } from "@/lib/pinyin-search";');
  expect(compact(source)).toContain(compact(`
    const pinyinHitIds = new Set<string>();
    if (isPinyinQuery(deferredQuery.trim())) {
      for (const [id, page] of filteredSet) {
        if (!indexHitIds.has(id)) {
          const title = getPageTitle(page);
          if (pinyinMatchIndices(title, deferredQuery.trim()) !== null) {
            pinyinHitIds.add(id);
          }
        }
      }
    }
  `));
});
