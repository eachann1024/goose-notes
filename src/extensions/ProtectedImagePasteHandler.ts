import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const URL_REGEX = /^https?:\/\/[^\s]+$/i;
const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi;
const LINK_PREFIX = "受保护图片链接：";

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/&amp;/gi, "&");
}

function isProtectedGmailImageUrl(raw: string): boolean {
  try {
    const url = new URL(normalizeUrl(raw));
    if (url.hostname !== "mail.google.com") return false;
    return url.searchParams.get("view") === "fimg";
  } catch {
    return false;
  }
}

function extractUrlsFromPlainText(text: string): string[] {
  const urls: string[] = [];
  const normalizedText = text.trim();

  if (URL_REGEX.test(normalizedText)) {
    urls.push(normalizeUrl(normalizedText));
  }

  const matches = normalizedText.matchAll(MARKDOWN_IMAGE_REGEX);
  for (const match of matches) {
    if (match[1]) {
      urls.push(normalizeUrl(match[1]));
    }
  }

  return urls;
}

function extractUrlsFromHtml(html: string): string[] {
  try {
    const doc = new window.DOMParser().parseFromString(html, "text/html");
    return Array.from(doc.querySelectorAll("img[src]"))
      .map((img) => normalizeUrl(img.getAttribute("src") || ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export const ProtectedImagePasteHandler = Extension.create({
  name: "protectedImagePasteHandler",

  addProseMirrorPlugins() {
    const linkMarkType = this.editor.schema.marks.link;

    return [
      new Plugin({
        key: new PluginKey("protectedImagePasteHandler"),
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain") || "";
            const html = event.clipboardData?.getData("text/html") || "";
            const candidateUrls = [...extractUrlsFromPlainText(text), ...extractUrlsFromHtml(html)];

            const protectedUrls = Array.from(
              new Set(candidateUrls.filter(isProtectedGmailImageUrl)),
            );
            if (!protectedUrls.length) return false;

            event.preventDefault();

            const { state } = view;
            const tr = state.tr;
            const replacement = protectedUrls
              .map((url) => `${LINK_PREFIX}${url}`)
              .join("\n");

            const start = state.selection.from;
            tr.insertText(replacement, state.selection.from, state.selection.to);

            // 将 URL 区域加上 link mark，仍可一键打开原图链接
            if (linkMarkType) {
              let offset = 0;
              protectedUrls.forEach((url, index) => {
                const urlStart = start + offset + LINK_PREFIX.length;
                const urlEnd = urlStart + url.length;
                tr.addMark(urlStart, urlEnd, linkMarkType.create({ href: url }));
                offset += LINK_PREFIX.length + url.length;
                if (index < protectedUrls.length - 1) {
                  offset += 1; // 换行符
                }
              });
            }

            tr.setMeta("uiEvent", "paste");
            tr.setMeta("addToHistory", true);
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
