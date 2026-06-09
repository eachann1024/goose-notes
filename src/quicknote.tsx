/**
 * 速记小窗入口（独立 browser 窗口加载 quicknote.html → 本文件）。
 *
 * 复用主窗的 bootstrap（host fs / 迁移 / hydration / guard）以保证数据层一致，
 * 仅把渲染根换成 <QuickNoteApp/>。小窗是「草稿便签」：内容只落 useQuickNote.draftContent
 * （持久化草稿），不对应真实笔记，不自动存盘；点左上角「保存到笔记本」才入库并清空。
 */
import { bootstrap } from "./main";
import { useQuickNote } from "./stores/useQuickNote";
import { QuickNoteApp } from "./pages/quick-note/QuickNoteApp";
import "./pages/quick-note/quicknote.css";

void (async () => {
  // useQuickNote 持久化了 draftContent / pinned / 窗口尺寸，需在渲染前 rehydrate，
  // 否则草稿 page 拿不到已有草稿内容。
  await useQuickNote.persist.rehydrate();
  await bootstrap(() => <QuickNoteApp />);
})();
