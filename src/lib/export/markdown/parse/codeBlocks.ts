import { parseCodeFenceInfo } from "./blockHelpers";

export function parseCodeBlock(lines: string[], startIndex: number) {
  const content: any[] = [];
  let i = startIndex;
  const line = lines[i];
  const trimmedLine = line.trim();
    if (trimmedLine === "$$") {
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "$$") {
        mathLines.push(lines[i]);
        i++;
      }
      content.push({
        type: "codeBlock",
        props: { language: "math" },
        content: mathLines.join("\n"),
      });
      i++;
      return { block: content[0], nextIndex: i };
    }

    const fenceOpen = line.match(/^(```|~~~)(.*)$/);
    if (fenceOpen) {
      const fence = fenceOpen[1];
      const fenceInfo = parseCodeFenceInfo(fenceOpen[2].trim());
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      const codeBlockProps: Record<string, unknown> = {
        language: fenceInfo.language,
      };
      if (fenceInfo.summary) {
        codeBlockProps.summary = fenceInfo.summary;
      }
      if (fenceInfo.collapsed) {
        codeBlockProps.collapsed = true;
      }
      content.push({
        type: "codeBlock",
        props: codeBlockProps,
        content: codeLines.join("\n"),
      });
      i++;
      return { block: content[0], nextIndex: i };
    }

  return null;
}
