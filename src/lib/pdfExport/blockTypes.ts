import type { ReactNode } from "react";

// Structural input accepts saved documents without depending on an editor instance.
export type PdfBlock = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: PdfBlock[];
};
export type PdfContext = {
  transformInlineContent: (content: unknown) => ReactNode;
};
export type PdfBlockMapping = (
  block: PdfBlock,
  context: PdfContext,
  depth: number,
  ordinal?: number,
) => ReactNode | Promise<ReactNode>;
