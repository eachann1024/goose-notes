import MarkdownIt from "markdown-it";
import { AiWritePreviewCard } from "@/pages/workspace/components/ai/AiWritePreviewCard";
import type {
  AgentArtifact,
  MarkdownNoteArtifact,
} from "@/agent/core/types";
import type { AiWritePlan } from "@/lib/ai-write";

const md = new MarkdownIt({ html: false, linkify: true, typographer: false }).enable("table");

interface AgentArtifactViewProps {
  artifact: AgentArtifact;
  applying?: boolean;
  onConfirmMarkdownNote?: (artifact: MarkdownNoteArtifact) => void | Promise<void>;
  onCancelMarkdownNote?: (artifact: MarkdownNoteArtifact) => void;
  onOpenResult?: (pageId: string) => void;
}

function TextResponseRenderer({ artifact }: { artifact: AgentArtifact }) {
  if (artifact.type !== "text_response") return null;
  return (
    <div
      className="ai-markdown break-words text-sm leading-7"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: md.render(artifact.text) }}
    />
  );
}

function MarkdownNoteRenderer({
  artifact,
  applying = false,
  onConfirmMarkdownNote,
  onCancelMarkdownNote,
  onOpenResult,
}: AgentArtifactViewProps) {
  if (artifact.type !== "markdown_note") return null;
  return (
    <AiWritePreviewCard
      plan={artifact.plan}
      applying={applying}
      onConfirm={(plan: AiWritePlan) => {
        onConfirmMarkdownNote?.({
          type: "markdown_note",
          plan,
        });
      }}
      onCancel={(plan: AiWritePlan) => {
        onCancelMarkdownNote?.({
          type: "markdown_note",
          plan,
        });
      }}
      onOpenResult={onOpenResult}
    />
  );
}

const AGENT_ARTIFACT_RENDERERS = {
  text_response: TextResponseRenderer,
  markdown_note: MarkdownNoteRenderer,
} as const;

export function AgentArtifactView(props: AgentArtifactViewProps) {
  const Renderer =
    AGENT_ARTIFACT_RENDERERS[
      props.artifact.type as keyof typeof AGENT_ARTIFACT_RENDERERS
    ];
  if (!Renderer) return null;
  return <Renderer {...props} />;
}
