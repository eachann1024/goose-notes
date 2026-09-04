import { memo, type ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cjk } from "@streamdown/cjk";
import { Check } from "lucide-react";

function MdInput({
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

const PLAN_MD_COMPONENTS = {
  input: MdInput,
};

const PLAN_MD_PLUGINS = { cjk };

const PLAN_MD_CONTROLS = {
  table: false,
  code: true,
  mermaid: false,
} as const;

export const PlanMarkdown = memo(function PlanMarkdown({
  markdown,
}: {
  markdown: string;
}) {
  const text = markdown.trim();
  if (!text) return null;
  return (
    <Streamdown
      className="ai-md notebook-ai-plan-md min-w-0 max-w-full"
      mode="static"
      components={PLAN_MD_COMPONENTS}
      plugins={PLAN_MD_PLUGINS}
      controls={PLAN_MD_CONTROLS}
      parseIncompleteMarkdown={false}
    >
      {text}
    </Streamdown>
  );
});
