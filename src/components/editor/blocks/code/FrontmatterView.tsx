import { useMemo } from "react";
import { parse as parseYaml } from "yaml";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

interface FrontmatterViewProps {
  value: string;
  className?: string;
}

interface ParsedEntry {
  key: string;
  value: unknown;
  type: "string" | "number" | "boolean" | "array" | "object" | "null" | "unknown";
}

function getValueType(val: unknown): ParsedEntry["type"] {
  if (val === null || val === undefined) return "null";
  if (typeof val === "string") return "string";
  if (typeof val === "number") return "number";
  if (typeof val === "boolean") return "boolean";
  if (Array.isArray(val)) return "array";
  if (typeof val === "object") return "object";
  return "unknown";
}

export function FrontmatterView({ value, className }: FrontmatterViewProps) {
  const { parsedData, parseError } = useMemo(() => {
    if (!value || !value.trim()) {
      return { parsedData: null, parseError: null };
    }
    try {
      const data: unknown = parseYaml(value);
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return { parsedData: data as Record<string, unknown>, parseError: null };
      }
      return { parsedData: null, parseError: "Frontmatter 根节点必须是键值对象" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "YAML 解析失败";
      return { parsedData: null, parseError: message };
    }
  }, [value]);

  const entries: ParsedEntry[] = useMemo(() => {
    if (!parsedData) return [];
    return Object.entries(parsedData).map(([key, val]) => ({
      key,
      value: val,
      type: getValueType(val),
    }));
  }, [parsedData]);

  if (parseError) {
    return (
      <div className={cn("rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200", className)}>
        <div className="flex items-center gap-1.5 font-medium mb-1">
          <LucideIcons.AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          <span>YAML 解析提示</span>
        </div>
        <div className="font-mono text-[11px] opacity-90">{parseError}</div>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className={cn("flex items-center justify-center p-4 text-xs text-muted-foreground italic", className)}>
        无元数据属性
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full rounded-lg border border-[var(--goose-block-subtle-border)] bg-[var(--goose-block-subtle-bg)] text-xs overflow-hidden shadow-xs",
        className,
      )}
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--goose-block-subtle-border)] bg-muted/40 text-muted-foreground text-[11px]">
            <th className="w-1/3 px-3 py-2 font-medium tracking-wide">属性 (Key)</th>
            <th className="w-2/3 px-3 py-2 font-medium tracking-wide">值 (Value)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--goose-block-subtle-border)]">
          {entries.map(({ key, value: val, type }) => (
            <tr key={key} className="hover:bg-muted/20 transition-colors">
              <td className="px-3 py-2 font-mono text-[11px] font-medium text-foreground/80 align-top select-text">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--goose-accent)]/70 inline-block" />
                  {key}
                </span>
              </td>
              <td className="px-3 py-2 align-top select-text">
                {type === "boolean" ? (
                  <span
                    className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium",
                      val ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {String(val)}
                  </span>
                ) : type === "array" ? (
                  <div className="flex flex-wrap gap-1">
                    {(val as unknown[]).map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/80 text-[11px] font-sans border border-border/40"
                      >
                        {typeof item === "object" ? JSON.stringify(item) : String(item)}
                      </span>
                    ))}
                  </div>
                ) : type === "object" ? (
                  <pre className="font-mono text-[11px] whitespace-pre-wrap bg-muted/40 p-1.5 rounded border border-border/30">
                    {JSON.stringify(val, null, 2)}
                  </pre>
                ) : (
                  <span className="font-sans text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                    {val === null || val === undefined ? (
                      <span className="italic text-muted-foreground/50">null</span>
                    ) : (
                      String(val)
                    )}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
