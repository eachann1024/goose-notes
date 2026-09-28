import { useId, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  EDITOR_FONT_SIZE_MIN,
  EDITOR_FONT_SIZE_MAX,
  EDITOR_LINE_HEIGHT_MIN,
  EDITOR_LINE_HEIGHT_MAX,
} from "@/stores/settings/types";

export function ReadingPreferences({ showPreview = true, fontSize, lineHeight, onFontSizeChange, onLineHeightChange }: {
  showPreview?: boolean;
  fontSize: number;
  lineHeight: number;
  onFontSizeChange: (value: number) => void;
  onLineHeightChange: (value: number) => void;
}) {
  const id = useId();
  const fields = [
    { key: "size", label: "正文字号", value: fontSize, min: EDITOR_FONT_SIZE_MIN, max: EDITOR_FONT_SIZE_MAX, step: 1, unit: "px", change: onFontSizeChange },
    { key: "height", label: "正文行距", value: lineHeight, min: EDITOR_LINE_HEIGHT_MIN, max: EDITOR_LINE_HEIGHT_MAX, step: 0.05, unit: "倍", change: onLineHeightChange },
  ];
  return <div className="space-y-5">
    {showPreview && <section aria-label="阅读效果预览" className="border-b border-border px-2 pb-5">
      <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>实时预览</span><span className="tabular-nums">{fontSize} px / {lineHeight.toFixed(2)}</span>
      </div>
      <h3 className="mb-3 text-lg font-semibold tracking-tight">留一点呼吸，给文字</h3>
      <div className="space-y-3 text-foreground" style={{ fontSize, lineHeight }}>
        <p>把今天值得记住的事，写在这里。不必急着整理思绪，先为一个灵感留下一点空间。</p>
        <p>让行与行之间留一点呼吸，长篇笔记也能从容读完。</p>
      </div>
    </section>}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {fields.map(field => <div key={field.key}>
        <div className="flex items-center justify-between gap-3 text-sm">
          <label htmlFor={`${id}-${field.key}`}>{field.label}</label>
          <output htmlFor={`${id}-${field.key}`} className="font-medium tabular-nums">{field.step < 1 ? field.value.toFixed(2) : field.value} {field.unit}</output>
        </div>
        <input id={`${id}-${field.key}`} type="range" min={field.min} max={field.max} step={field.step} value={field.value}
          aria-valuetext={`${field.value} ${field.unit}`}
          style={{ "--range-fill": `${(field.value - field.min) / (field.max - field.min) * 100}%` } as CSSProperties}
          onChange={event => field.change(event.currentTarget.valueAsNumber)} />
        <div className="flex justify-between text-xs text-muted-foreground"><span>{field.min} {field.unit}</span><span>{field.max} {field.unit}</span></div>
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="行距预设">
      {([[1.4, "紧凑"], [1.5, "标准"], [1.8, "舒适"], [2, "宽松"]] as const).map(([value, label]) =>
        <Button key={value} type="button" variant="outline" size="sm" aria-pressed={lineHeight === value}
          className="rounded-lg border-border text-xs aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
          onClick={() => onLineHeightChange(value)}>{label} {value.toFixed(2)}</Button>)}
    </div>
  </div>;
}
