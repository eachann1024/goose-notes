import { diffTextLines } from "../batchPlanDiff";

export function ReviewDiff({
  oldText,
  newText,
}: {
  oldText: string;
  newText: string;
}) {
  return (
    <div className="notebook-ai-plan-diff" role="group" aria-label="变更差异">
      {diffTextLines(oldText, newText).map((line, i) => (
        <div
          key={i}
          className={`notebook-ai-plan-diff-line${line.kind === "eq" ? "" : ` notebook-ai-plan-diff-line--${line.kind}`}`}
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
