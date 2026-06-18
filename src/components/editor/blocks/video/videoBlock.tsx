import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import {
  createVideoBlockConfig,
  videoParse,
  type BlockNoteEditor,
} from "@blocknote/core";
import * as LucideIcons from "lucide-react";

function VideoUrlInput({
  block,
  editor,
}: {
  block: any;
  editor: BlockNoteEditor<any, any, any>;
}) {
  const [url, setUrl] = useState("");

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    editor.updateBlock(block, { props: { url: trimmed } });
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--goose-block-subtle-border)] bg-[var(--goose-block-subtle-bg)] px-3 py-2">
      <LucideIcons.Link className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        onBlur={submit}
        placeholder="粘贴视频链接..."
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        autoFocus
      />
    </div>
  );
}

export const customVideoBlock = createReactBlockSpec(
  createVideoBlockConfig({}),
  {
    render: ({ block, editor }) => {
      if (!block.props.url) {
        return <VideoUrlInput block={block} editor={editor} />;
      }
      return (
        <video
          src={block.props.url}
          controls
          className="bn-visual-media rounded-md max-w-full"
        />
      );
    },
    parse: videoParse({}),
    toExternalHTML: ({ block }) => {
      if (!block.props.url) {
        return <p></p>;
      }
      return <video src={block.props.url} controls className="bn-visual-media rounded-md max-w-full" />;
    },
  },
)();
