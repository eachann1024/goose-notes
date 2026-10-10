import { MessagePrimitive, AttachmentPrimitive } from "@assistant-ui/react";
import { Image as ImageIcon } from "@/components/ui/icons";
import type { NotebookAiMessage } from "@/lib/notebook-ai/types";
import type { PreviewContent } from "@/lib/preview/previewAction";
import { buildUserMessageSegments } from "@/lib/notebook-ai/userMessageSegments";
import { formatSelectionQuotePromptLabel } from "@/components/editor/ai/composer/selectionQuote";
import { useEditorPageContext } from "@/components/editor/platform/hostContext";
import { navigateNotebookAiReference } from "@/lib/notebook-ai/navigateReference";
import { usePages } from "@/stores/usePages";
import { getPageTitle } from "@/components/editor/utils/page-title";
import { getUserDisplayText, getUserImageParts } from "./messagePresentation";
import { MessageActionBar } from "./MessageActionBar";
export function UserMessage({
  msg,
  setPreviewContent,
}: {
  msg: NotebookAiMessage;
  setPreviewContent: (content: PreviewContent) => void;
}) {
  const { onOpenPage } = useEditorPageContext();
  const text = getUserDisplayText(msg);
  const hasLiveImages = getUserImageParts(msg).length > 0;
  const persistedImages = msg.metadata?.imageAttachments ?? [];
  const references = msg.metadata?.references ?? [];
  const skills = msg.metadata?.skills ?? [];
  const selectionQuotes = msg.metadata?.selectionQuotes ?? [];
  const textSegments = buildUserMessageSegments(
    text,
    references,
    skills,
    selectionQuotes,
  );

  return (
    // 整行 w-full + justify-end：百分比/可用宽度有确定参照，避免 w-fit+max-w% 在旧内核上失效。
    // 左侧 pl 留呼吸缝；气泡 min-w-0 可在剩余宽度内换行，不再横向撑破后被左侧裁切。
    <MessagePrimitive.Root className="notebook-ai-message notebook-ai-message-user flex w-full min-w-0 justify-end pl-5">
      <div className="flex min-w-0 max-w-full flex-col items-end gap-1">
        <div className="notebook-ai-message-text notebook-ai-user-bubble min-w-0 max-w-full space-y-2 rounded-[14px] rounded-tr-[4px] px-3 py-2 text-sm text-foreground leading-relaxed">
          <MessagePrimitive.Attachments>
            {({ attachment }) => {
              const imagePart = attachment.content.find(
                (part) => part.type === "image",
              );
              return (
                <AttachmentPrimitive.Root className="inline-flex max-w-full flex-col gap-1">
                  {imagePart?.type === "image" ? (
                    <img
                      src={imagePart.image}
                      alt={attachment.name}
                      className="h-20 w-20 cursor-zoom-in rounded-[8px] object-cover"
                      onClick={() =>
                        setPreviewContent({
                          kind: "image",
                          data: imagePart.image,
                          fileName: attachment.name,
                        })
                      }
                    />
                  ) : null}
                  <span className="sr-only">
                    <AttachmentPrimitive.Name />
                  </span>
                </AttachmentPrimitive.Root>
              );
            }}
          </MessagePrimitive.Attachments>
          {!hasLiveImages && persistedImages.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {persistedImages.map((image) => (
                <span
                  key={`${image.filename}-${image.mediaType}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-[6px] bg-background/45 px-1.5 py-1 text-[11px] text-muted-foreground"
                >
                  <ImageIcon className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                  <span className="max-w-[170px] truncate">
                    {image.filename}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
          {textSegments.length > 0 ? (
            <div className="notebook-ai-message-inline select-text">
              {textSegments.map((segment, index) => {
                if (segment.type === "text") {
                  return (
                    <span
                      key={`text-${index}`}
                      className="notebook-ai-message-inline-text"
                    >
                      {segment.text}
                    </span>
                  );
                }
                if (segment.type === "skill") {
                  return (
                    <span
                      key={segment.key}
                      data-ai-skill-chip=""
                      className="ai-composer-chip inline-flex max-w-full min-w-0 items-center align-middle mx-1 truncate rounded-[6px] px-1.5 text-[11px] font-medium leading-none"
                      title={`本地 Skill：/${segment.skill.name}`}
                      aria-label={`本地 Skill：/${segment.skill.name}`}
                    >
                      /{segment.skill.name}
                    </span>
                  );
                }
                if (segment.type === "selectionQuote") {
                  return (
                    <span
                      key={segment.key}
                      data-ai-selection-quote-chip=""
                      className="ai-composer-chip inline-flex max-w-full min-w-0 items-center align-middle mx-1 truncate rounded-[6px] px-1.5 text-[11px] font-medium leading-none"
                      title={segment.quote.text}
                      aria-label={`选区引用，来自${segment.quote.pageTitle}`}
                    >
                      {formatSelectionQuotePromptLabel(segment.quote)}
                    </span>
                  );
                }
                const page =
                  usePages.getState().pages[segment.reference.pageId];
                const title = page
                  ? getPageTitle(page)
                  : segment.reference.titleSnapshot;
                return (
                  <button
                    key={segment.key}
                    type="button"
                    data-ai-mention-chip=""
                    className="ai-composer-chip inline-flex max-w-full min-w-0 items-center align-middle mx-1 truncate rounded-[6px] px-1.5 text-[11px] font-medium leading-none"
                    title={`打开：${title}`}
                    aria-label={`打开：${title}`}
                    onClick={() =>
                      navigateNotebookAiReference(
                        segment.reference.pageId,
                        onOpenPage,
                      )
                    }
                  >
                    @{title}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <MessageActionBar />
      </div>
    </MessagePrimitive.Root>
  );
}
