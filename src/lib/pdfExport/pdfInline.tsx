import { Text, Link } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Style } from "@react-pdf/types";
import { PDF_DM_MONO_FAMILY, PDF_FONT_FAMILY } from "./fontConfig";
import { pdfColor } from "./pdfTextStyle";

export function renderPdfInline(content: unknown): ReactNode {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  return content.map((item, index) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return null;
    if (item.type === "hardBreak") return "\n";
    if (item.type === "pageMention") {
      const title =
        typeof item.props?.title === "string" && item.props.title.trim()
          ? item.props.title.trim()
          : "未命名";
      return (
        <Text key={index}>{title.startsWith("@") ? title : `@${title}`}</Text>
      );
    }
    if (item.type === "link") {
      const label = renderPdfInline(item.content);
      return typeof item.href === "string" &&
        /^(https?:|mailto:|tel:|#)/i.test(item.href) ? (
        <Link key={index} src={item.href}>
          {label}
        </Link>
      ) : (
        <Text key={index}>{label}</Text>
      );
    }
    const styles = item.styles ?? {};
    const style: Style = {
      fontWeight: styles.bold ? 700 : undefined,
      fontStyle: styles.italic ? "italic" : undefined,
      textDecoration:
        styles.underline && styles.strike
          ? "underline line-through"
          : styles.underline
            ? "underline"
            : styles.strike
              ? "line-through"
              : undefined,
      color: pdfColor(styles.textColor),
      backgroundColor:
        pdfColor(styles.backgroundColor, true) ??
        (styles.code ? "#f3f4f6" : undefined),
      fontFamily: styles.code
        ? [PDF_DM_MONO_FAMILY, PDF_FONT_FAMILY]
        : undefined,
    };
    return (
      <Text key={index} style={style}>
        {typeof item.text === "string"
          ? item.text
          : renderPdfInline(item.content)}
      </Text>
    );
  });
}
