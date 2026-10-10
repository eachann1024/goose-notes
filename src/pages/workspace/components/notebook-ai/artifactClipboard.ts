import { toast } from "@/components/ui/sonner";
import { saveBlobAndReveal } from "@/lib/export/fileSave";
import { getEditorPlatform } from "@/components/editor/platform/context";
import { shell } from "@/lib/electron-platform/shell";
export async function copyText(text: string) {
  try {
    await navigator.clipboard?.writeText(text);
    toast.success("已复制");
    return;
  } catch {
    shell.copyText(text);
    toast.success("已复制");
  }
}

export async function downloadText(
  text: string,
  filename: string,
  mimeType: string,
) {
  try {
    const blob = new Blob([text], { type: mimeType });
    await saveBlobAndReveal(blob, filename);
    toast.success("已保存");
  } catch {
    toast.error("保存失败");
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("图片编码失败"));
    };
    reader.onerror = () => reject(new Error("图片编码失败"));
    reader.readAsDataURL(blob);
  });
}

export async function copyImagePayload(payload: string | Blob) {
  const dataUrl =
    typeof payload === "string" ? payload : await blobToDataUrl(payload);
  await getEditorPlatform().clipboard.copyImage(dataUrl);
  toast.success("已复制到剪贴板");
}
