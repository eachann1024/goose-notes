import { installRuntimePolyfills } from "./bootstrap/runtimePolyfills";
import { installIteratorPolyfills } from "./bootstrap/iteratorPolyfills";
import { applyRolldownPolyfills } from "@/lib/rolldown-polyfill";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import "./index.css";
import "./fonts.css";
import { clearStartupSettling, markStartupSettling } from "@/lib/appearance";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BootstrapScreen } from "./bootstrap/BootstrapScreen";
import { initializeApplicationState } from "./bootstrap/initializeApplicationState";
import { scheduleBackgroundWarmup } from "./bootstrap/backgroundWarmup";

installRuntimePolyfills();
installIteratorPolyfills();
applyRolldownPolyfills();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// 渲染目标由调用方传入：主窗口（index-entry.tsx）渲染 <App/>，速记小窗（quicknote.tsx）
// 渲染 <QuickNoteApp/>，但两者复用同一套 host fs / 迁移 / hydration / guard 流程，
// 保证两个窗口进程的数据层初始化完全一致（共享 Electron db）。
//
// 注意：renderRoot 必须显式传入、本模块不再 import App。这是刻意的解耦——
// 小窗（quicknote.tsx → 本模块）不再经默认参数把整个 workspace <App/> 拖进依赖图，
// 使 quicknote 构建能甩掉 echarts / PDF 导出 / AI 图表等仅主应用需要的重型代码。
export const bootstrap = async (
  renderRoot: () => ReactNode,
  options: { lean?: boolean; beforeInit?: () => Promise<void> | void } = {},
) => {
  // lean=true（速记小窗）：跳过主应用专属的重活——加载+修复全部笔记、AI 聊天记录水合、
  // 缺失笔记本恢复、代码风格全量迁移、legacy 迁移、收件箱消费。这些与「草稿便签」无关，
  // 且 hydrateFromStorage 随笔记数线性变慢，是小窗冷启动的最大开销。
  // 仍保留：initHostFs（编辑器文件能力）、设置/字体（主题）、保存守卫（关窗 flush 草稿）。
  const { lean = false, beforeInit } = options;
  // Chromium also matches text inputs clicked by a pointer as :focus-visible.
  // Track pointer entry globally so both windows keep Tab focus without click rings.
  document.addEventListener(
    "pointerdown",
    () => {
      document.documentElement.dataset.goosePointerFocus = "true";
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Tab")
        delete document.documentElement.dataset.goosePointerFocus;
    },
    true,
  );
  const root = createRoot(rootElement);
  // 主工作区在恢复完成前保持 index.html 的空 root，不提交启动页或首页。
  // Electron 会先显示 BrowserWindow，任何提前 render 都会成为用户看见的错误首帧。
  // 速记是独立入口，继续沿用原有的草稿初始化页，不受主工作区门控影响。
  if (lean) {
    root.render(<BootstrapScreen lean />);
  }

  try {
    await initializeApplicationState(lean, beforeInit);

    const renderApplication = () => {
      // 首帧稳定前禁用过渡：内部组件不会从默认值播动画追赶到恢复值。
      // 解除由主 App 挂载后的 releaseStartupSettlingAfterPaint 完成；
      // 速记小窗（lean）是独立根组件，不做门控也不标记。
      if (!lean) {
        markStartupSettling();
      }
      root.render(
        <ErrorBoundary
          fallback={(error) => {
            // 渲染失败时不会有 App 挂载来解除标记，这里兜底清理（幂等）。
            clearStartupSettling();
            return <BootstrapScreen lean={lean} error={error} />;
          }}
        >
          {renderRoot()}
        </ErrorBoundary>,
      );
    };

    if (lean) {
      renderApplication();
    } else {
      const { prepareWorkspaceStartup, renderWorkspaceAfterStartup } =
        await import("@/lib/workspaceStartup");
      const startupResult = await renderWorkspaceAfterStartup({
        prepare: prepareWorkspaceStartup,
        render: renderApplication,
        renderError: (error) => {
          console.error("[bootstrap] 工作区恢复失败", error);
          clearStartupSettling();
          root.render(<BootstrapScreen lean={false} error={error} />);
        },
      });
      if (startupResult === "error") return;
    }
  } catch (error) {
    console.error("[bootstrap] 初始化失败", error);
    clearStartupSettling();
    root.render(<BootstrapScreen lean={lean} error={error} />);
    return;
  }

  scheduleBackgroundWarmup(rootElement);
};

// 入口区分（两个独立 HTML 入口各自显式启动，本模块不再自动启动）：
// - index.html → src/index-entry.tsx：import App + 调用 bootstrap(() => <App/>)
// - quicknote.html → src/quicknote.tsx：调用 bootstrap(() => <QuickNoteApp/>)
// 自动启动逻辑下沉到 index-entry.tsx，避免本共享模块静态引用 <App/>（详见 bootstrap 注释）。
