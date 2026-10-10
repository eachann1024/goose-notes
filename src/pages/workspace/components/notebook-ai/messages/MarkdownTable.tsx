import type { ComponentProps } from "react";
import { Check } from "@/components/ui/icons";
export function MdInput({
  node,
  ...props
}: ComponentProps<"input"> & { node?: unknown }) {
  void node;
  if (props.type === "checkbox") {
    return (
      <span
        className="ai-md-checkbox"
        data-checked={props.checked ? "true" : "false"}
      >
        {props.checked ? <Check strokeWidth={2.5} /> : null}
      </span>
    );
  }
  return <input {...props} />;
}

/**
 * 覆盖 Streamdown 默认 table。
 * 默认 table 带 w-full / 无 nowrap，且 utility 可能未被 Tailwind 扫到；
 * 这里用 plain DOM + notebook-ai.css 锁宽度与横向滚动（兼容 Electron 旧内核）。
 * node 是 hast 节点，不能落到 DOM 上；className 常含 w-full，直接丢弃。
 */
export function MdTable({
  children,
  node,
  className,
  style,
  ...props
}: ComponentProps<"table"> & { node?: unknown }) {
  void node;
  void className;
  // 单层 scroll wrapper：外层直接 overflow-x:auto，避免「外 hidden + 内 auto」在旧 Chromium 失效
  return (
    <div
      className="ai-md-table-scroll"
      data-streamdown="table-wrapper"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <table
        className="ai-md-table"
        data-streamdown="table"
        style={{
          width: "auto",
          minWidth: "100%",
          maxWidth: "none",
          tableLayout: "auto",
          borderCollapse: "collapse",
          ...style,
        }}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function MdThead({
  children,
  node,
  className,
  ...props
}: ComponentProps<"thead"> & { node?: unknown }) {
  void node;
  void className;
  return (
    <thead data-streamdown="table-header" {...props}>
      {children}
    </thead>
  );
}

export function MdTh({
  children,
  node,
  className,
  style,
  ...props
}: ComponentProps<"th"> & { node?: unknown }) {
  void node;
  void className;
  return (
    <th
      data-streamdown="table-header-cell"
      style={{ whiteSpace: "normal", wordBreak: "break-word", ...style }}
      {...props}
    >
      {children}
    </th>
  );
}

export function MdTr({
  children,
  node,
  className,
  ...props
}: ComponentProps<"tr"> & { node?: unknown }) {
  void node;
  void className;
  return (
    <tr data-streamdown="table-row" {...props}>
      {children}
    </tr>
  );
}

export function MdTd({
  children,
  node,
  className,
  style,
  ...props
}: ComponentProps<"td"> & { node?: unknown }) {
  void node;
  void className;
  return (
    <td
      data-streamdown="table-cell"
      style={{ whiteSpace: "normal", wordBreak: "break-word", ...style }}
      {...props}
    >
      {children}
    </td>
  );
}

/** 工具 / 正文 part 共享的每消息上下文（组件函数本身保持模块级稳定） */
