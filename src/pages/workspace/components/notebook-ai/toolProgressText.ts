import { getBatchPlanProgressText } from "./batchPlanProgressText";
import { formatNotebookAiError } from "@/lib/notebook-ai/errors";
import type { ToolProgressPart, ProgressStep } from "./toolProgressModel";
import {
  readObject,
  asString,
  truncate,
  SKILL_LABELS,
} from "./toolProgressValues";
function countOutput(output: unknown) {
  return Array.isArray(output) ? output.length : undefined;
}

export function getToolProgressStepText(
  part: ToolProgressPart,
): Pick<ProgressStep, "label" | "detail"> {
  const input = readObject(part.input);
  const output = readObject(part.output);
  const outputCount = countOutput(part.output);
  const outputError = asString(output?.error) || asString(part.errorText);
  const title =
    asString(input?.title) ||
    asString(output?.title) ||
    asString(input?.pageId) ||
    asString(output?.pageId);

  if (part.type === "tool-loadSkill") {
    const skill = asString(input?.skill);
    const skillLabel = SKILL_LABELS[skill] || "所需";
    return {
      label: "加载能力",
      detail: output ? `已加载${skillLabel}能力` : `正在加载${skillLabel}能力`,
    };
  }

  if (part.type === "tool-listNotebooks") {
    return {
      label: "查看笔记本",
      detail:
        outputCount === undefined
          ? "正在查看可用笔记本"
          : `已查看 ${outputCount} 个笔记本`,
    };
  }

  if (part.type === "tool-listPages") {
    return {
      label: "查看页面列表",
      detail:
        outputCount === undefined
          ? "正在查看当前笔记本页面"
          : `已查看 ${outputCount} 个页面`,
    };
  }

  if (part.type === "tool-searchNotes") {
    const query = truncate(asString(input?.query) || "关键词");
    return {
      label: "搜索笔记",
      detail:
        outputCount === undefined
          ? `正在搜索“${query}”`
          : outputCount > 0
            ? `搜索“${query}”，找到 ${outputCount} 条`
            : `搜索“${query}”，没有匹配结果`,
    };
  }

  if (part.type === "tool-searchWeb") {
    const query = truncate(asString(input?.query) || "关键词");
    if (outputError)
      return { label: "联网搜索", detail: formatNotebookAiError(outputError) };
    return {
      label: "联网搜索",
      detail: output ? `已完成“${query}”的联网搜索` : `正在搜索“${query}”`,
    };
  }

  if (part.type === "tool-readWebPage") {
    const url = asString(input?.url);
    const host = (() => {
      try {
        return url ? new URL(url).hostname : "网页";
      } catch {
        return "网页";
      }
    })();
    if (outputError)
      return { label: "读取网页", detail: formatNotebookAiError(outputError) };
    return {
      label: "读取网页",
      detail: output
        ? `已读取 ${truncate(host)}`
        : `正在读取 ${truncate(host)}`,
    };
  }

  if (part.type === "tool-readPage") {
    if (outputError)
      return { label: "读取笔记", detail: formatNotebookAiError(outputError) };
    return {
      label: "读取笔记",
      detail: title ? `已读取《${truncate(title)}》` : "正在读取当前笔记",
    };
  }

  if (part.type === "tool-createPage") {
    return {
      label: "创建页面",
      detail: title ? `创建《${truncate(title)}》` : "正在创建新页面",
    };
  }

  if (part.type === "tool-updatePage") {
    const ok = output?.ok === true;
    const needsMarkdown = output?.needsMarkdown === true;
    return {
      label: "写入页面",
      detail: needsMarkdown
        ? "等待完整正文后再写入"
        : ok
          ? title
            ? `已写入《${truncate(title)}》`
            : "已写入当前页"
          : title
            ? `正在写入《${truncate(title)}》`
            : "正在写入当前页",
    };
  }

  if (part.type === "tool-replaceInPage") {
    const replacedCount =
      typeof output?.replacedCount === "number"
        ? output.replacedCount
        : undefined;
    return {
      label: "替换内容",
      detail:
        replacedCount === undefined
          ? title
            ? `正在替换《${truncate(title)}》`
            : "正在替换页面内容"
          : replacedCount > 0
            ? title
              ? `《${truncate(title)}》已替换 ${replacedCount} 处`
              : `已替换 ${replacedCount} 处`
            : title
              ? `《${truncate(title)}》没有找到可替换内容`
              : "没有找到可替换内容",
    };
  }

  if (part.type === "tool-appendToPage") {
    const ok = output?.ok === true;
    return {
      label: "追加内容",
      detail: outputError
        ? formatNotebookAiError(outputError)
        : ok
          ? title
            ? `已追加到《${truncate(title)}》`
            : "已追加到当前页"
          : title
            ? `正在追加到《${truncate(title)}》`
            : "正在追加页面内容",
    };
  }

  if (part.type === "tool-renamePage") {
    const ok = output?.ok === true;
    return {
      label: "重命名页面",
      detail: outputError
        ? formatNotebookAiError(outputError)
        : ok
          ? title
            ? `已重命名为《${truncate(title)}》`
            : "已完成重命名"
          : title
            ? `正在重命名为《${truncate(title)}》`
            : "正在重命名页面",
    };
  }

  if (part.type === "tool-deletePages") {
    const deletedCount =
      typeof output?.deletedCount === "number"
        ? output.deletedCount
        : undefined;
    return {
      label: "删除页面",
      detail: outputError
        ? formatNotebookAiError(outputError)
        : deletedCount === undefined
          ? "正在把页面移入垃圾箱"
          : `已删除 ${deletedCount} 个页面`,
    };
  }

  if (part.type === "tool-executeBatchPlan") {
    return getBatchPlanProgressText(part, input, output, title);
  }

  if (part.type === "tool-showTable") {
    return {
      label: "展示表格",
      detail: title ? `已生成表格《${truncate(title)}》` : "已生成表格",
    };
  }

  if (part.type === "tool-showChart") {
    return {
      label: "展示图表",
      detail: title ? `已生成图表《${truncate(title)}》` : "已生成图表",
    };
  }

  if (part.type === "tool-showDiagram") {
    return {
      label: "展示图形",
      detail: title ? `已生成图形《${truncate(title)}》` : "已生成图形",
    };
  }

  if (part.type === "tool-showSvg") {
    const done = part.output !== undefined;
    return {
      label: "展示图片",
      detail: done
        ? title
          ? `已生成图片《${truncate(title)}》`
          : "已生成图片"
        : title
          ? `正在生成《${truncate(title)}》`
          : "正在生成图片",
    };
  }

  return {
    label: "处理内容",
    detail: part.output !== undefined ? "已完成本步骤" : "正在处理请求",
  };
}
