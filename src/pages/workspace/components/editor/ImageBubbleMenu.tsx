import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEditorState } from "@tiptap/react";
import { useScrollHide } from "@/hooks/useScrollHide";

function isRemoteUrl(src: string | undefined): boolean {
  if (!src) return false;
  return src.startsWith("http://") || src.startsWith("https://");
}

function isStorageReference(src: string): boolean {
  return src.startsWith("uuid:") || src.startsWith("att:");
}

function isFileUrl(src: string): boolean {
  return src.startsWith("file://");
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

function decodeFileUrlPath(fileUrl: string): string {
  const rawPath = fileUrl.replace(/^file:\/\//, "");
  const normalizedWindows = rawPath.replace(/^\/([A-Za-z]:[\\/])/, "$1");
  try {
    return decodeURIComponent(normalizedWindows).replace(/\\/g, "/");
  } catch {
    return normalizedWindows.replace(/\\/g, "/");
  }
}

function getFallbackImageExtension(mimeType: string): string {
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/x-icon": "ico",
  };

  return extMap[mimeType] || "png";
}

function hasFileExtension(filename: string): boolean {
  const lastDotIndex = filename.lastIndexOf(".");
  return lastDotIndex > 0 && lastDotIndex < filename.length - 1;
}

function ensureFilenameExtension(filename: string, extension: string): string {
  return hasFileExtension(filename) ? filename : `${filename}.${extension}`;
}

function getParentDirectoryPath(targetPath: string): string {
  const normalizedPath = targetPath.replace(/[\\/]+$/, "");
  if (!normalizedPath) return targetPath;

  const lastSlashIndex = Math.max(
    normalizedPath.lastIndexOf("/"),
    normalizedPath.lastIndexOf("\\"),
  );

  if (lastSlashIndex < 0) return normalizedPath;
  if (lastSlashIndex === 0) return normalizedPath.slice(0, 1);
  return normalizedPath.slice(0, lastSlashIndex);
}

function resolveImageFileName(src: string, mimeType: string): string {
  const fallbackExt = getFallbackImageExtension(mimeType);

  if (src.startsWith("data:") || src.startsWith("blob:") || isStorageReference(src)) {
    return `image.${fallbackExt}`;
  }

  try {
    const pathLike = isFileUrl(src) ? decodeFileUrlPath(src) : new URL(src).pathname;
    const rawName = pathLike.split("/").pop() || "";
    const cleaned = rawName.split("?")[0].split("#")[0].trim();
    if (cleaned) return ensureFilenameExtension(cleaned, fallbackExt);
  } catch {
    const rawName = src.split("/").pop() || "";
    const cleaned = rawName.split("?")[0].split("#")[0].trim();
    if (cleaned) return ensureFilenameExtension(cleaned, fallbackExt);
  }

  return `image.${fallbackExt}`;
}

function canUseClipboardImageApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined"
  );
}

function canUseClipboardTextApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function"
  );
}

function getUToolsApi():
  | (Window["utools"] & {
      copyImage?: (source: string) => boolean | Promise<boolean>;
      copyText?: (text: string) => unknown;
      showSaveDialog?: (options?: Record<string, unknown>) => unknown;
      shellShowItemInFolder?: (targetPath: string) => boolean | Promise<boolean>;
      shellOpenPath?: (targetPath: string) => boolean | Promise<boolean>;
    })
  | null {
  if (typeof window === "undefined" || !window.utools) return null;
  return window.utools;
}

function canUseUToolsImageCopy(): boolean {
  return typeof getUToolsApi()?.copyImage === "function";
}

function canUseUToolsTextCopy(): boolean {
  return typeof getUToolsApi()?.copyText === "function";
}

async function resolveImageBlob(src: string): Promise<Blob | null> {
  if (isStorageReference(src)) {
    try {
      const { imageStorage } = await import("@/lib/imageStorage");
      return imageStorage.load(src);
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

async function convertBlobToPng(blob: Blob): Promise<Blob | null> {
  if (blob.type === "image/png") return blob;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = objectUrl;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function copyImageToClipboardApi(src: string): Promise<boolean> {
  try {
    if (!canUseClipboardImageApi()) return false;

    const blob = await resolveImageBlob(src);
    if (!blob) return false;

    const pngBlob = await convertBlobToPng(blob);
    const finalBlob = pngBlob || blob;

    await navigator.clipboard.write([new ClipboardItem({ [finalBlob.type]: finalBlob })]);
    return true;
  } catch {
    return false;
  }
}

async function copyImageToUTools(src: string): Promise<boolean> {
  const utools = getUToolsApi();
  if (!utools || typeof utools.copyImage !== "function") return false;

  try {
    if (src.startsWith("data:image/")) {
      return (await Promise.resolve(utools.copyImage(src))) !== false;
    }

    if (isFileUrl(src)) {
      const filePath = decodeFileUrlPath(src);
      return (await Promise.resolve(utools.copyImage(filePath))) !== false;
    }

    if (isAbsolutePath(src)) {
      return (await Promise.resolve(utools.copyImage(src))) !== false;
    }

    const blob = await resolveImageBlob(src);
    if (!blob) return false;

    const base64 = await blobToBase64(blob);
    return (await Promise.resolve(utools.copyImage(base64))) !== false;
  } catch {
    return false;
  }
}

async function saveBlobViaUTools(blob: Blob, defaultFilename: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const utools = getUToolsApi();
  const gooseFs = window.gooseFs;

  if (!utools || typeof utools.showSaveDialog !== "function" || !gooseFs) {
    return false;
  }

  const saveResult = await Promise.resolve(
    utools.showSaveDialog({
      title: "保存图片",
      defaultPath: defaultFilename,
      buttonLabel: "保存",
    }),
  );

  const normalizeSavePath = (value: unknown): string | null => {
    if (typeof value === "string" && value.trim()) return value;
    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === "string");
      return typeof first === "string" && first.trim() ? first : null;
    }
    if (value && typeof value === "object") {
      const canceled =
        "canceled" in value && Boolean((value as { canceled?: unknown }).canceled);
      if (canceled) return null;
      const filePath =
        "filePath" in value && typeof (value as { filePath?: unknown }).filePath === "string"
          ? (value as { filePath: string }).filePath
          : null;
      return filePath?.trim() ? filePath : null;
    }
    return null;
  };

  const targetPath = normalizeSavePath(saveResult);
  if (!targetPath) return true;

  const fallbackExt = getFallbackImageExtension(blob.type || "image/png");
  const finalTargetPath = ensureFilenameExtension(targetPath, fallbackExt);
  const base64 = await blobToBase64(blob);
  const payload = base64.replace(/^data:.*;base64,/, "");
  const saved = gooseFs.writeFileAsync
    ? await gooseFs.writeFileAsync(finalTargetPath, payload, "base64")
    : gooseFs.writeFile(finalTargetPath, payload, "base64");

  if (!saved) return false;

  const folderPath = getParentDirectoryPath(finalTargetPath);
  let revealed = false;
  if (typeof gooseFs.revealItemInFolder === "function") {
    revealed = Boolean(await gooseFs.revealItemInFolder(finalTargetPath));
  }

  if (!revealed && typeof utools?.shellShowItemInFolder === "function") {
    revealed = Boolean(await Promise.resolve(utools.shellShowItemInFolder(finalTargetPath)));
  }

  if (!revealed && typeof utools?.shellOpenPath === "function") {
    revealed = Boolean(await Promise.resolve(utools.shellOpenPath(folderPath)));
  }

  return true;
}

function downloadBlobByAnchor(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadUrlByAnchor(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

type ImageBubbleMenuProps = Omit<
  React.ComponentProps<typeof BubbleMenu>,
  "children"
>;

// 辅助函数：根据当前对齐状态判断 pressed
function getAlignFromStyle(
  style: string | null | undefined,
): "left" | "center" | "right" {
  if (!style) return "left";
  if (
    style.includes("margin: 0 0 0 auto") ||
    style.includes("margin: 0px 0px 0px auto")
  )
    return "right";
  if (
    style.includes("margin: 0 auto 0 0") ||
    style.includes("margin: 0px auto 0px 0px")
  )
    return "left";
  if (style.includes("margin: 0 auto;") || style.includes("margin: 0px auto"))
    return "center";
  return "left";
}

// 辅助函数：生成新的 containerStyle
function setAlignStyle(
  currentStyle: string | null | undefined,
  align: "left" | "center" | "right",
): string {
  // 移除已有的 margin 样式
  const baseStyle = (currentStyle || "").replace(/margin:[^;]*;?/g, "").trim();
  const marginMap = {
    left: "margin: 0 auto 0 0;",
    center: "margin: 0 auto;",
    right: "margin: 0 0 0 auto;",
  };
  return `${baseStyle} ${marginMap[align]}`.trim();
}

export function ImageBubbleMenu({ editor, ...props }: ImageBubbleMenuProps) {
  const isHidden = useScrollHide(editor);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuRef.current) return;
    menuRef.current.style.zIndex = "20000";
  }, []);

  const editorState = useEditorState<{
    currentAlign: "left" | "center" | "right";
    imageSrc: string | undefined;
  }>({
    editor: editor ?? null,
    selector: (ctx) => {
      if (!ctx.editor) {
        return { currentAlign: "left", imageSrc: undefined };
      }
      const attrs = ctx.editor.getAttributes("imageResize");
      return {
        currentAlign: getAlignFromStyle(attrs?.containerStyle),
        imageSrc: attrs?.src as string | undefined,
      };
    },
  });
  if (!editor || !editorState) return null;

  const { currentAlign, imageSrc } = editorState;

  const isRemote = isRemoteUrl(imageSrc);
  const alignToggleClass =
    "h-7 min-w-7 rounded-md px-0 text-foreground/90 hover:bg-muted data-[state=on]:bg-accent data-[state=on]:text-foreground";
  const iconButtonClass =
    "h-7 w-7 rounded-md p-0 text-foreground/90 hover:bg-muted disabled:cursor-not-allowed disabled:hover:bg-transparent";
  const dangerButtonClass =
    "h-7 w-7 rounded-md p-0 text-destructive/80 hover:bg-destructive/10 hover:text-destructive";
  const canCopyLink = canUseClipboardTextApi() || canUseUToolsTextCopy();
  const canCopyImage = (() => {
    if (!imageSrc) return false;
    if (canUseUToolsImageCopy()) return true;
    if (!canUseClipboardImageApi()) return false;
    if (isStorageReference(imageSrc)) return true;
    if (imageSrc.startsWith("data:") || imageSrc.startsWith("blob:")) return true;
    if (isRemoteUrl(imageSrc)) return true;
    return false;
  })();
  const canCopy = Boolean(imageSrc) && (isRemote ? canCopyLink : canCopyImage);

  const copyTooltipContent = (() => {
    if (!imageSrc) {
      return <p>当前图片不可复制</p>;
    }
    if (!canCopy) {
      return isRemote ? (
        <p>当前环境不支持复制链接</p>
      ) : (
        <p>当前环境不支持复制图片</p>
      );
    }
    if (isRemote) {
      return (
        <div className="max-w-48 text-center">
          <p>复制链接</p>
          <p className="text-xs text-muted-foreground">
            远程图片只能复制链接，本地图片才可复制原文件
          </p>
        </div>
      );
    }
    return <p>复制图片</p>;
  })();

  const handleCopy = async () => {
    if (!imageSrc || !canCopy) return;
    if (isRemote) {
      try {
        if (canUseClipboardTextApi()) {
          await navigator.clipboard.writeText(imageSrc);
          return;
        }
        if (canUseUToolsTextCopy()) {
          UToolsAdapter.copyToClipboard(imageSrc);
          return;
        }
      } catch {
        // Clipboard permission may be denied at runtime even when API exists.
      }
      UToolsAdapter.showNotification("复制失败：当前环境不支持复制链接");
      return;
    }

    let copied = false;
    if (canUseUToolsImageCopy()) {
      copied = await copyImageToUTools(imageSrc);
    }
    if (!copied && canUseClipboardImageApi()) {
      copied = await copyImageToClipboardApi(imageSrc);
    }
    if (!copied) {
      UToolsAdapter.showNotification("复制失败：当前图片来源不支持复制");
    }
  };

  const handleDownload = async () => {
    if (!imageSrc) return;

    const blob = await resolveImageBlob(imageSrc);
    if (!blob) {
      if (isRemote) {
        downloadUrlByAnchor(imageSrc, "image");
        return;
      }
      UToolsAdapter.showNotification("下载失败：当前图片来源不支持下载");
      return;
    }

    const filename = resolveImageFileName(imageSrc, blob.type || "image/png");
    const savedViaUTools = await saveBlobViaUTools(blob, filename);
    if (!savedViaUTools) {
      downloadBlobByAnchor(blob, filename);
    }
  };

  const handleAlign = (align: "left" | "center" | "right") => {
    if (!editor.isActive("imageResize")) return;
    const attrs = editor.getAttributes("imageResize");
    const newStyle = setAlignStyle(attrs?.containerStyle, align);
    editor
      .chain()
      .focus()
      .updateAttributes("imageResize", { containerStyle: newStyle })
      .run();
  };

  return (
    <TooltipProvider>
      <BubbleMenu
        ref={menuRef}
        editor={editor}
        pluginKey="imageBubbleMenu"
        appendTo={() => document.body}
        className={cn(
          "z-[20000] flex items-center gap-0.5 rounded-[10px] border border-border/75 bg-popover p-1 shadow-[0_8px_22px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)] backdrop-blur-[1px] animate-in fade-in-0 zoom-in-95 duration-150 transition-opacity dark:border-white/15 dark:bg-[#2f3437]",
          isHidden ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        shouldShow={({ editor }: { editor: Editor }) => {
          return !isHidden && editor.isEditable && editor.isActive("imageResize");
        }}
        {...props}
      >
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={currentAlign === "left"}
              onPressedChange={() => handleAlign("left")}
              aria-label="左对齐"
              className={alignToggleClass}
            >
              <LucideIcons.AlignLeft className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>左对齐</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={currentAlign === "center"}
              onPressedChange={() => handleAlign("center")}
              aria-label="居中"
              className={alignToggleClass}
            >
              <LucideIcons.AlignCenter className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>居中</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={currentAlign === "right"}
              onPressedChange={() => handleAlign("right")}
              aria-label="右对齐"
              className={alignToggleClass}
            >
              <LucideIcons.AlignRight className="h-[15px] w-[15px]" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            <p>右对齐</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 opacity-70" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {canCopy ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className={iconButtonClass}
              >
                {isRemote ? (
                  <LucideIcons.Link className="h-[15px] w-[15px]" />
                ) : (
                  <LucideIcons.Copy className="h-[15px] w-[15px]" />
                )}
              </Button>
            ) : (
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  className={iconButtonClass}
                >
                  {isRemote ? (
                    <LucideIcons.Link className="h-[15px] w-[15px]" />
                  ) : (
                    <LucideIcons.Copy className="h-[15px] w-[15px]" />
                  )}
                </Button>
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent>{copyTooltipContent}</TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className={iconButtonClass}
            >
              <LucideIcons.Download className="h-[15px] w-[15px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>下载图片</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().deleteSelection().run()}
              className={dangerButtonClass}
            >
              <LucideIcons.Trash2 className="h-[15px] w-[15px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>删除图片</p>
          </TooltipContent>
        </Tooltip>
      </BubbleMenu>
    </TooltipProvider>
  );
}
