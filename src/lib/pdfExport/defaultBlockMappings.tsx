import { Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { PdfBlockMapping } from "./blockTypes";
import { blockTextStyle, splitPdfWord } from "./pdfTextStyle";
import { PDF_DM_MONO_FAMILY, PDF_FONT_FAMILY } from "./fontConfig";
import { tablePdfMapping } from "./pdfTable";

export function createDefaultPdfBlockMappings(): Record<
  string,
  PdfBlockMapping
> {
  const paragraph: PdfBlockMapping = (block, context) => (
    <Text style={blockTextStyle(block.props)}>
      {context.transformInlineContent(block.content) || " "}
    </Text>
  );
  const list: PdfBlockMapping = (block, context, _depth, ordinal) => (
    <View style={{ flexDirection: "row" }}>
      <Text style={{ width: 32, flexShrink: 0 }}>
        {block.type === "numberedListItem"
          ? `${ordinal ?? 1}.`
          : block.type === "checkListItem"
            ? block.props?.checked
              ? "[x]"
              : "[ ]"
            : "•"}
      </Text>
      <Text
        style={{
          ...blockTextStyle(block.props),
          flexGrow: 1,
          flexBasis: 0,
          minWidth: 0,
        }}
      >
        {context.transformInlineContent(block.content) || " "}
      </Text>
    </View>
  );
  return {
    paragraph,
    bulletListItem: list,
    numberedListItem: list,
    checkListItem: list,
    toggleListItem: list,
    heading: (block, context) => (
      <Text
        minPresenceAhead={24}
        style={{
          ...blockTextStyle(block.props),
          fontWeight: 700,
          lineHeight: 1.4,
          marginBottom: 4,
          fontSize: [24, 20, 17, 15, 13, 12][
            Math.max(0, Math.min(5, Number(block.props?.level || 1) - 1))
          ],
          marginTop: 8,
        }}
      >
        {block.props?.isToggleable ? "▾ " : ""}
        {context.transformInlineContent(block.content)}
      </Text>
    ),
    codeBlock: (block, context) => (
      <View style={{ padding: 9, backgroundColor: "#f5f5f5", borderRadius: 4 }}>
        <Text
          hyphenationCallback={splitPdfWord}
          style={{
            fontFamily: [PDF_DM_MONO_FAMILY, PDF_FONT_FAMILY],
            fontSize: 11,
          }}
        >
          {context.transformInlineContent(block.content) || " "}
        </Text>
      </View>
    ),
    divider: () => (
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: "#d1d5db",
          marginVertical: 6,
        }}
      />
    ),
    quote: (block, context) => (
      <View
        style={{
          borderLeftWidth: 3,
          borderLeftColor: "#9ca3af",
          paddingLeft: 10,
        }}
      >
        {paragraph(block, context, 0) as ReactNode}
      </View>
    ),
    table: tablePdfMapping,
  };
}
