import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { FileUp, LoaderCircle } from "lucide-react";
import { FileTrigger } from "@/components/ui/file-trigger";
import {
  fileStorage,
  getFileUploadAvailability,
  MAX_FILE_ATTACHMENT_SIZE,
} from "@/lib/fileStorage";
import { cn } from "@/lib/utils";

export function FileUploadPanel({ editor, deleteNode }: NodeViewProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availability = getFileUploadAvailability();
  const helperText = `支持任意格式，单文件 ${Math.floor(
    MAX_FILE_ATTACHMENT_SIZE / (1024 * 1024),
  )}MB 以内`;

  const insertFileAttachment = useCallback(
    (attrs: {
      storageRef: string;
      fileName: string;
      mimeType: string;
      size: number;
      uploadedAt: number;
    }) => {
      deleteNode();
      editor.chain().focus().setFileAttachment(attrs).run();
    },
    [deleteNode, editor],
  );

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!availability.enabled) {
        setError(availability.reason || "当前状态不支持上传附件");
        return;
      }

      if (file.size === 0) {
        setError("不能上传空文件");
        return;
      }

      if (file.size > MAX_FILE_ATTACHMENT_SIZE) {
        setError("文件不能超过 10MB");
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        const attrs = await fileStorage.save(file);
        insertFileAttachment(attrs);
      } catch (uploadError) {
        console.error("[FileUploadPanel] upload failed", uploadError);
        setError(
          uploadError instanceof Error ? uploadError.message : "附件上传失败，请稍后重试",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [availability.enabled, availability.reason, insertFileAttachment],
  );

  return (
    <NodeViewWrapper className="file-upload-placeholder-node my-4">
      <div
        className="rounded-[16px] border border-border/80 bg-popover p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
        contentEditable={false}
      >
        <FileTrigger
          onFileChange={(file) => file && handleFileSelect(file)}
          disabled={isUploading || !availability.enabled}
          disabledReason={
            isUploading ? "正在上传" : availability.enabled ? undefined : availability.reason
          }
          helperText={helperText}
          errorText={error}
        >
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "flex h-auto w-full items-center justify-center gap-3 rounded-[14px] border border-dashed border-border/80 bg-background/70 px-4 py-5 text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] transition-all",
              isUploading || !availability.enabled
                ? "cursor-not-allowed text-muted-foreground/80"
                : "text-muted-foreground hover:border-primary/45 hover:bg-[hsl(var(--goose-selected-bg))] hover:text-foreground",
              error &&
                "border-destructive/35 bg-destructive/5 text-destructive hover:border-destructive/45 hover:bg-destructive/5 hover:text-destructive",
            )}
          >
            {isUploading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            <span>{isUploading ? "附件上传中..." : "点击选择文件"}</span>
          </Button>
        </FileTrigger>
      </div>
    </NodeViewWrapper>
  );
}
