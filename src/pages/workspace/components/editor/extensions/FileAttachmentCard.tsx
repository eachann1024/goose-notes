import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ExternalLink, File, LoaderCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  fileStorage,
  formatAttachmentSize,
  sanitizeFileName,
} from "@/lib/fileStorage";
import { cn } from "@/lib/utils";

function normalizeAttachmentFileName(value: string, fallback: string): string {
  const trimmedValue = value.trim();
  const normalizedValue = trimmedValue.length > 0 ? trimmedValue : fallback;
  return sanitizeFileName(normalizedValue) || "attachment";
}

export function FileAttachmentCard(props: NodeViewProps) {
  const { node, selected, updateAttributes, editor } = props;
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftFileName, setDraftFileName] = useState(node.attrs.fileName || "未命名附件");
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);

  const isEditable = editor.isEditable;
  const displayedFileName = node.attrs.fileName || "未命名附件";

  useEffect(() => {
    if (isEditingName) return;
    setDraftFileName(displayedFileName);
  }, [displayedFileName, isEditingName]);

  useEffect(() => {
    if (!isEditingName) return;
    fileNameInputRef.current?.focus();
    fileNameInputRef.current?.select();
  }, [isEditingName]);

  const handleOpen = useCallback(async () => {
    if (isOpening) return;

    setIsOpening(true);
    setError(null);

    try {
      const result = await fileStorage.open(node.attrs.storageRef, {
        fileName: node.attrs.fileName,
        size: node.attrs.size,
      });

      if (!result.ok) {
        setError(result.error || "打开失败");
      }
    } catch (openError) {
      console.error("[FileAttachmentCard] open failed", openError);
      setError("打开失败");
    } finally {
      setIsOpening(false);
    }
  }, [isOpening, node.attrs.fileName, node.attrs.size, node.attrs.storageRef]);

  const handleStartEditName = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!isEditable) return;
      event.preventDefault();
      event.stopPropagation();
      skipBlurCommitRef.current = false;
      setError(null);
      setDraftFileName(displayedFileName);
      setIsEditingName(true);
    },
    [displayedFileName, isEditable],
  );

  const handleCancelEditName = useCallback(() => {
    skipBlurCommitRef.current = true;
    setDraftFileName(displayedFileName);
    setIsEditingName(false);
  }, [displayedFileName]);

  const handleCommitEditName = useCallback(() => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }

    const normalizedFileName = normalizeAttachmentFileName(
      draftFileName,
      displayedFileName,
    );

    setDraftFileName(normalizedFileName);
    setIsEditingName(false);

    if (normalizedFileName !== node.attrs.fileName) {
      updateAttributes({ fileName: normalizedFileName });
    }
  }, [displayedFileName, draftFileName, node.attrs.fileName, updateAttributes]);

  const handleFileNameKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const nativeEvent = event.nativeEvent as KeyboardEvent & {
        isComposing?: boolean;
        keyCode?: number;
      };
      const isImeComposing =
        nativeEvent.isComposing === true || nativeEvent.keyCode === 229;

      if (
        event.key === "Enter" &&
        !isImeComposing
      ) {
        event.preventDefault();
        handleCommitEditName();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        handleCancelEditName();
      }
    },
    [handleCancelEditName, handleCommitEditName],
  );

  return (
    <NodeViewWrapper className="file-attachment-node my-4" contentEditable={false}>
      <div
        className={cn(
          "flex w-full items-start gap-3 rounded-[16px] border border-border/80 bg-popover px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition-all",
          selected && "border-border shadow-[0_12px_28px_rgba(15,23,42,0.1)]",
        )}
      >
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-border/75 bg-background/75 text-foreground/80">
          <File className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          {isEditingName ? (
            <Input
              ref={fileNameInputRef}
              value={draftFileName}
              onChange={(event) => setDraftFileName(event.target.value)}
              onBlur={handleCommitEditName}
              onKeyDown={handleFileNameKeyDown}
              onMouseDown={(event) => event.stopPropagation()}
              spellCheck={false}
              draggable={false}
              aria-label="修改附件名称"
              className="h-8 rounded-[10px] border border-border/80 bg-background px-2.5 py-1 text-sm font-medium text-foreground shadow-none outline-none ring-0 ring-offset-0 focus-visible:ring-0"
            />
          ) : (
            <button
              type="button"
              onClick={handleStartEditName}
              onMouseDown={(event) => {
                if (!isEditable) return;
                event.preventDefault();
                event.stopPropagation();
              }}
              draggable={false}
              className={cn(
                "block w-full truncate text-left text-sm font-medium text-foreground outline-none transition-colors",
                isEditable
                  ? "cursor-text hover:text-foreground/80"
                  : "cursor-default",
              )}
              aria-label={isEditable ? "点击修改附件名称" : "附件名称"}
            >
              {displayedFileName}
            </button>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatAttachmentSize(node.attrs.size)}</span>
            <span className="text-border">•</span>
            <span className="truncate">{node.attrs.mimeType || "未知类型"}</span>
          </div>
        </div>

        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => void handleOpen()}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                aria-disabled={isOpening}
                draggable={false}
                className={cn(
                  "ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 self-center rounded-full border border-border/80 bg-background/80 px-3 text-xs font-medium text-muted-foreground transition-colors",
                  isOpening
                    ? "cursor-not-allowed opacity-90"
                    : "hover:border-foreground/15 hover:text-foreground",
                )}
              >
                {isOpening ? (
                  <>
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    <span>打开中</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>点击打开</span>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {isOpening && <TooltipContent>正在使用系统默认应用打开</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      </div>

      {error && (
        <div className="mt-3 rounded-[12px] border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </NodeViewWrapper>
  );
}
