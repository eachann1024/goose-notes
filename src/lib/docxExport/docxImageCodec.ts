export function parseBase64Image(
  src: string,
): { data: string; mimeType: string; extension: string } | null {
  const match = src.match(/^data:(image\/([a-zA-Z0-9+.-]+));base64,(.+)$/);
  if (!match) return null;
  const subtype = match[2] === "jpeg" ? "jpg" : match[2];
  return {
    mimeType: match[1],
    extension: subtype,
    data: match[3],
  };
}

export type ImageBufferResult = {
  buffer: Uint8Array;
  type: "png" | "jpg" | "gif" | "bmp";
};

export function mimeToImageType(mimeType: string): ImageBufferResult["type"] {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("bmp")) return "bmp";
  return "png";
}
