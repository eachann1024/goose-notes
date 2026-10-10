import { FilePlus2, FileText, Pencil, Trash2 } from "@/components/ui/icons";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { usePages } from "@/stores/usePages";
import { diffTextLines, planOperationKindLabel } from "../batchPlanDiff";
import { PlanMarkdown } from "../PlanMarkdown";
import { parseInput } from "./planParsing";
import type { BatchOperation, ApprovalPlanPart } from "./types";
function lookupPageTitle(pageId: string): string {
  const page = usePages.getState().getPage(pageId);
  return page ? getPageTitle(page) : "笔记";
}

function operationFileTitle(operation: BatchOperation): string {
  if (operation.type === "create") {
    return operation.title.trim() || "新建笔记";
  }
  if (operation.type === "edit") {
    return operation.title?.trim() || lookupPageTitle(operation.pageId);
  }
  if (operation.type === "search_replace") {
    return lookupPageTitle(operation.pageId);
  }
  if (operation.pageIds.length === 1) {
    return lookupPageTitle(operation.pageIds[0]!);
  }
  return `${operation.pageIds.length} 页`;
}

function PlanFileIcon({ type }: { type: BatchOperation["type"] }) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (type === "create")
    return <FilePlus2 className={className} strokeWidth={1.75} />;
  if (type === "delete")
    return <Trash2 className={className} strokeWidth={1.75} />;
  if (type === "search_replace") {
    return <Pencil className={className} strokeWidth={1.75} />;
  }
  return <FileText className={className} strokeWidth={1.75} />;
}

function PlanReplaceBody({
  oldString,
  newString,
}: {
  oldString: string;
  newString: string;
}) {
  const lines = diffTextLines(oldString, newString);
  return (
    <div className="notebook-ai-plan-diff" role="group" aria-label="替换片段">
      {lines.map((line, index) => (
        <div
          key={`${line.kind}-${index}`}
          className={
            line.kind === "del"
              ? "notebook-ai-plan-diff-line notebook-ai-plan-diff-line--del"
              : line.kind === "add"
                ? "notebook-ai-plan-diff-line notebook-ai-plan-diff-line--add"
                : "notebook-ai-plan-diff-line"
          }
        >
          <span aria-hidden>
            {line.kind === "del" ? "−" : line.kind === "add" ? "+" : " "}
          </span>
          <span>{line.text || " "}</span>
        </div>
      ))}
    </div>
  );
}

function PlanOperationBody({ operation }: { operation: BatchOperation }) {
  if (operation.type === "delete") {
    return (
      <ul className="notebook-ai-plan-delete-list">
        {operation.pageIds.map((pageId) => (
          <li key={pageId}>{lookupPageTitle(pageId)}</li>
        ))}
      </ul>
    );
  }
  if (operation.type === "search_replace") {
    return (
      <PlanReplaceBody
        oldString={operation.oldString}
        newString={operation.newString}
      />
    );
  }
  return <PlanMarkdown markdown={operation.markdown} />;
}

/** 变更计划：整页文档块，展示全部改动（编辑器排版），不截成几行预览 */
export function BatchPlanProposal({ part }: { part: ApprovalPlanPart }) {
  const input = parseInput(part.input, part.toolCallId);
  const operations = input.operations ?? [];
  const heading =
    input.summary?.trim() || input.title?.trim() || "将写入以下变更";
  if (
    !input.summary?.trim() &&
    !input.title?.trim() &&
    operations.length === 0
  ) {
    return null;
  }

  return (
    <div className="notebook-ai-work-proposal">
      <h4>{heading}</h4>
      {operations.map((operation) => (
        <section
          key={operation.operationId}
          className="notebook-ai-plan-file"
          aria-label={`${planOperationKindLabel(operation.type)} ${operationFileTitle(operation)}`}
        >
          <div className="notebook-ai-plan-file-bar">
            <PlanFileIcon type={operation.type} />
            <span className="notebook-ai-plan-file-kind">
              {planOperationKindLabel(operation.type)}
            </span>
            <span className="notebook-ai-plan-file-title">
              {operationFileTitle(operation)}
            </span>
          </div>
          <div className="notebook-ai-plan-file-body">
            <PlanOperationBody operation={operation} />
          </div>
        </section>
      ))}
    </div>
  );
}
