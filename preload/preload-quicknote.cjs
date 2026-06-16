// B 插件（鹅的速记）preload：纯速记小窗 toggle 逻辑，无主窗联动。
// CJS 运行在 uTools preload 上下文（Electron renderer），避免与 ESM 主项目冲突。

if (typeof window !== "undefined" && typeof utools !== "undefined") {
  window.utools = utools;

  // ── 速记小窗（独立 browser 窗口）──────────────────────────────
  const QUICKNOTE_WIDTH = 480;
  const QUICKNOTE_MIN_WIDTH = 320;
  const QUICKNOTE_HEIGHT = 350;
  const QUICKNOTE_MIN_HEIGHT = 300;
  const QUICKNOTE_EDGE_GAP = 16;
  let quickNoteWin = null;
  let quickNotePinned = false;
  let quickNoteVisible = false;
  let quickNoteActiveMode = null;

  // 从 uTools dbStorage 读速记持久化偏好（与 A 插件共享同一 key，数据共通）。
  const readQuickNotePrefs = () => {
    const fallback = {
      windowWidth: QUICKNOTE_WIDTH,
      windowHeight: QUICKNOTE_HEIGHT,
      pinned: false,
    };
    try {
      const raw =
        utools.dbStorage && typeof utools.dbStorage.getItem === "function"
          ? utools.dbStorage.getItem("goose-note:quicknote")
          : null;
      if (typeof raw !== "string") return fallback;
      const parsed = JSON.parse(raw);
      const st = parsed && parsed.state ? parsed.state : parsed;
      const w = Number(st && st.windowWidth);
      const h = Number(st && st.windowHeight);
      return {
        windowWidth:
          Number.isFinite(w) && w >= QUICKNOTE_MIN_WIDTH ? Math.round(w) : QUICKNOTE_WIDTH,
        windowHeight:
          Number.isFinite(h) && h >= QUICKNOTE_MIN_HEIGHT ? Math.round(h) : QUICKNOTE_HEIGHT,
        pinned: !!(st && st.pinned),
      };
    } catch {
      return fallback;
    }
  };

  // getWindowType 三态：main=吸附在 uTools、detach=分离独立窗口、browser=createBrowserWindow 子窗。
  // B 插件：宿主（main/detach）负责开窗；子窗（browser）只走子窗侧逻辑。
  const isMainWindow =
    typeof utools.getWindowType !== "function" ||
    utools.getWindowType() !== "browser";

  // ── 子窗侧（browser）：监听父窗推过来的信号，转成 DOM 事件供 QuickNoteApp 消费 ──
  if (!isMainWindow) {
    // 注入标志：告知 QuickNoteApp 当前运行于 B 插件独立速记子窗，保存应 redirect 回 A。
    window.__GOOSE_QUICKNOTE_STANDALONE__ = true;
    try {
      const { ipcRenderer } = require("electron");
      ipcRenderer.on("quicknote:enter", (_e, data) => {
        window.dispatchEvent(
          new CustomEvent("goose-note:quicknote-enter", { detail: data || {} }),
        );
      });
      // 外部改了笔记：转 DOM 事件，小窗据此从 db 重读（防跨窗脏写）。
      ipcRenderer.on("quicknote:note-updated-from-main", (_e, pageId) => {
        window.dispatchEvent(
          new CustomEvent("goose-note:note-updated-external", {
            detail: { pageId },
          }),
        );
      });
    } catch { /* noop */ }
  }

  // ── 宿主侧（main/detach）：持有 quickNoteWin，处理子窗通过 sendToParent 发来的请求 ──
  if (isMainWindow) try {
    const { ipcRenderer } = require("electron");

    ipcRenderer.on("quicknote:pin", (_e, pinned) => {
      quickNotePinned = !!pinned;
      if (quickNoteWin && !quickNoteWin.isDestroyed?.()) {
        try {
          quickNoteWin.setAlwaysOnTop(quickNotePinned, "floating");
        } catch {
          try { quickNoteWin.setAlwaysOnTop(quickNotePinned); } catch { /* noop */ }
        }
      }
    });

    ipcRenderer.on("quicknote:close", () => {
      if (quickNoteWin && !quickNoteWin.isDestroyed?.()) {
        try { quickNoteWin.close(); } catch { /* noop */ }
      }
      quickNoteWin = null;
      quickNoteVisible = false;
      quickNoteActiveMode = null;
    });

    // 自动调整高度：子窗按内容算出目标高度，请求父窗 setSize（宽度保持不变）。
    ipcRenderer.on("quicknote:set-height", (_e, height) => {
      if (!quickNoteWin || quickNoteWin.isDestroyed?.()) return;
      const h = Math.max(QUICKNOTE_MIN_HEIGHT, Math.round(Number(height) || 0));
      try {
        const [w] = quickNoteWin.getSize?.() || [QUICKNOTE_WIDTH];
        quickNoteWin.setSize(w || QUICKNOTE_WIDTH, h, false);
      } catch { /* noop */ }
    });

    // 用户拖动边框停下后：读真实窗口尺寸，写回 dbStorage 速记偏好（持久化）。
    ipcRenderer.on("quicknote:persist-size", () => {
      if (!quickNoteWin || quickNoteWin.isDestroyed?.()) return;
      let size;
      try {
        size = quickNoteWin.getSize?.();
      } catch { /* noop */ }
      if (!Array.isArray(size) || size.length < 2) return;
      const w = Math.max(QUICKNOTE_MIN_WIDTH, Math.round(Number(size[0]) || 0));
      const h = Math.max(QUICKNOTE_MIN_HEIGHT, Math.round(Number(size[1]) || 0));
      try {
        const KEY = "goose-note:quicknote";
        const raw =
          utools.dbStorage && typeof utools.dbStorage.getItem === "function"
            ? utools.dbStorage.getItem(KEY)
            : null;
        let parsed = {};
        if (typeof raw === "string") {
          try { parsed = JSON.parse(raw) || {}; } catch { parsed = {}; }
        }
        const hasStateWrapper = parsed && typeof parsed.state === "object" && parsed.state;
        const state = hasStateWrapper ? parsed.state : parsed;
        state.windowWidth = w;
        state.windowHeight = h;
        const next = hasStateWrapper
          ? { ...parsed, state }
          : { state, version: 0 };
        if (utools.dbStorage && typeof utools.dbStorage.setItem === "function") {
          utools.dbStorage.setItem(KEY, JSON.stringify(next));
        }
      } catch { /* noop */ }
    });

    // 小窗改动某条笔记：B 插件无主窗，此处仅作空消费（防止 sendToParent 丢失报错）。
    ipcRenderer.on("quicknote:note-updated", (_e, _pageId) => {
      // B 无主窗，不需要跨窗同步；保留监听避免 ipc 无人接收时的警告。
    });

  } catch { /* noop */ }

  // ── 打开速记小窗 ──────────────────────────────────────────────
  const openQuickNoteWindow = (mode) => {
    // 再次触发 = 收起：直接 close 销毁，不留孤儿，下次触发必走新建路径。
    if (quickNoteWin && !quickNoteWin.isDestroyed?.()) {
      try {
        quickNoteWin.close();
      } catch { /* noop */ }
      quickNoteWin = null;
      quickNoteVisible = false;
      quickNoteActiveMode = null;
      return;
    }

    // 读持久化偏好：用记住的宽高开窗，并同步置顶态。
    const prefs = readQuickNotePrefs();
    quickNotePinned = prefs.pinned;
    const openWidth = prefs.windowWidth;
    const openHeight = prefs.windowHeight;

    // 定位到光标所在显示器的右上角。优先用 workArea（已扣除 macOS 菜单栏/Dock）。
    let area = null;
    try {
      const point = utools.getCursorScreenPoint();
      const display = utools.getDisplayNearestPoint(point);
      area = display ? display.workArea || display.bounds : null;
    } catch { /* noop */ }

    const winOpts = {
      show: false,
      width: openWidth,
      height: openHeight,
      minWidth: QUICKNOTE_MIN_WIDTH,
      minHeight: QUICKNOTE_MIN_HEIGHT,
      frame: false,
      resizable: true,
      skipTaskbar: true,
      closable: true,
      alwaysOnTop: quickNotePinned,
      roundedCorners: true,
      webPreferences: {
        preload: "preload-quicknote.js",
      },
    };
    if (area) {
      winOpts.x = Math.round(area.x + area.width - openWidth - QUICKNOTE_EDGE_GAP);
      winOpts.y = Math.round(area.y + QUICKNOTE_EDGE_GAP);
    }

    const url = `quicknote.html`;
    try {
      quickNoteWin = utools.createBrowserWindow(url, winOpts, () => {
        try {
          quickNoteWin.show();
          quickNoteWin.focus?.();
          quickNoteVisible = true;
          quickNoteActiveMode = mode;
          if (quickNotePinned) {
            try { quickNoteWin.setAlwaysOnTop(true, "screen-saver"); } catch { /* noop */ }
          }
        } catch { /* noop */ }
      });
    } catch { /* noop */ }
  };

  const triggerQuickNote = (mode) => {
    openQuickNoteWindow(mode);
  };

  // 无主界面模板插件：每个 feature 用 mode:"none"，enter 回调里开浮窗。
  // 必须用 isMainWindow 守卫——子窗（browser）加载 quicknote.html 时也会跑这份 preload，
  // 不能让子窗也定义 window.exports（否则覆盖宿主入口、重复定义）。
  if (isMainWindow) {
    const enterQuickNote = (mode) => {
      try {
        triggerQuickNote(mode);
      } catch { /* noop */ }
      // ⚠️ 关键：不要 outPlugin！B 进程要常驻持有 quickNoteWin 引用，
      // 否则第二次按速记键的 toggle 关窗会失效（引用丢了变成又开一个新窗）。
      // mode:"none" + 删了 main 后，uTools 不会再渲染空白主窗，无需 hideMainWindow。
      // （若真机仍残留 uTools 输入框，再视情况在此加 utools.hideMainWindow()，先不加。）
    };
    window.exports = {
      quicknote_new: {
        mode: "none",
        args: {
          enter: () => enterQuickNote("new"),
        },
      },
      quicknote_last: {
        mode: "none",
        args: {
          enter: () => enterQuickNote("last"),
        },
      },
    };
  }
}
