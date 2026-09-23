// Run: ./node_modules/.bin/esbuild tests/unit/deleteReceipt.assert.ts --bundle --platform=node --packages=external '--alias:@=./src' --jsx=automatic --outfile=node_modules/.tmp/deleteReceipt.assert.cjs && node node_modules/.tmp/deleteReceipt.assert.cjs
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { toast } from "../../src/components/ui/sonner";
import { showDeleteReceipt } from "../../src/components/ui/delete-receipt";

const original = toast.custom;
let html = "";
try {
  toast.custom = ((render) => {
    html = renderToStaticMarkup(render(1));
    return 1;
  }) as typeof toast.custom;

  showDeleteReceipt([
    { title: "甲.md", deleted: true },
    { title: "乙.md", deleted: true },
    { title: "丙.md", deleted: true },
    { title: "丁.md", deleted: false },
  ], true);
  assert.match(html, /3 项已移动，1 项未完成/);
  assert.doesNotMatch(html, /丁\.md|查看条目|项成功/);
  assert.doesNotMatch(html, /撤回删除/);

  showDeleteReceipt([{ title: "失败.md", deleted: false }], true, async () => {});
  assert.match(html, /1 项未完成/);
  assert.doesNotMatch(html, /撤回删除/);

  showDeleteReceipt([{ title: "本地.md", deleted: true }], true, async () => {});
  assert.match(html, /已移入系统回收站 · 本地\.md/);
  assert.match(html, /系统回收站/);
  assert.match(html, /撤回删除/);
  assert.match(html, /lucide-rotate-ccw/);
  assert.doesNotMatch(html, /bg-popover|shadow-lg|border-border/); // Sonner wrapper owns the only card.

  showDeleteReceipt([{ title: "应用页面", deleted: true }], false, () => {});
  assert.match(html, /已移入应用垃圾箱 · 应用页面/);
  assert.match(html, /撤回删除/);
} finally {
  toast.custom = original;
}
