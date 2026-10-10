import { Label } from "@/components/ui/label";
import {
  getEditorFontFamilies,
  SYSTEM_FONT_STACK,
  toCssFontFamily,
} from "@/lib/fontLoader";
import type { CustomFonts } from "@/stores/useSettings";
import { LocalFontSelect } from "./LocalFontSelect";

const emptyFonts: CustomFonts = {
  default: { label: null, font: null },
  serif: { label: null, font: null },
  mono: { label: null, font: null },
};

export function DefaultFontSelect({
  id,
  value,
  fontSize,
  lineHeight,
  onChange,
  showPreview = true,
}: {
  id: string;
  value: string | null;
  fontSize: number;
  lineHeight: number;
  onChange: (value: string | null) => void;
  showPreview?: boolean;
}) {
  const fontStack =
    value === null
      ? SYSTEM_FONT_STACK
      : getEditorFontFamilies("default", {
          ...emptyFonts,
          default: { label: null, font: value },
        })
          .map(toCssFontFamily)
          .join(", ");

  return (
    <div className="default-font-select space-y-3">
      <div className="flex flex-col gap-3">
        <Label htmlFor={id}>正文默认字体</Label>
        <LocalFontSelect
          id={id}
          label="正文默认字体"
          value={value}
          onChange={onChange}
          defaultLabel="默认"
          modes={[
            { family: "serif", label: "衬线" },
            { family: "monospace", label: "等宽" },
          ]}
        />
      </div>

      {showPreview && (
        <section
          aria-label="正文字体预览"
          className="rounded-lg border border-border/70 bg-muted/40 p-3 text-foreground"
          style={{ fontFamily: fontStack, fontSize, lineHeight }}
        >
          <p>
            你好，世界。 <span lang="en">A little room to think.</span>
          </p>
          <p>
            <strong>
              重点文字 · <span lang="en">Bold emphasis</span>
            </strong>
          </p>
        </section>
      )}
    </div>
  );
}
