/**
 * 速记小窗入口（独立 browser 窗口加载 quicknote.html → 本文件）。
 *
 * 复用主窗的 bootstrap（host fs / 迁移 / hydration / guard）以保证数据层一致，
 * 仅把渲染根换成 <QuickNoteApp/>。启动模式经 URL hash 传入：
 *   quicknote.html#new  → 新建空白速记
 *   quicknote.html#last → 直达上次（失效回退新建）
 */
import { bootstrap } from "./main";
import { useQuickNote } from "./stores/useQuickNote";
import { QuickNoteApp } from "./pages/quick-note/QuickNoteApp";
import "./pages/quick-note/quicknote.css";

function resolveMode(): "new" | "last" {
  const hash = (window.location.hash || "").replace(/^#/, "").toLowerCase();
  return hash === "last" ? "last" : "new";
}

void (async () => {
  // useQuickNote 持久化了 lastPageId / pinned，需在解析模式前 rehydrate。
  await useQuickNote.persist.rehydrate();
  await bootstrap(() => <QuickNoteApp mode={resolveMode()} />);
})();
