import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { isLocalFontAvailable, normalizeLocalFontName } from "@/lib/fontLoader";

export function LocalFontInput({
  id,
  value,
  onChange,
  placeholder,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const fontValue = draft ?? value;
  const [available, setAvailable] = useState(true);
  const unavailable = Boolean(fontValue.trim()) && !available;
  const commit = () => {
    const font = fontValue.trim();
    if (font && !normalizeLocalFontName(font)) {
      setAvailable(false);
      return;
    }
    if (font !== value) onChange(font);
    setDraft(null);
  };

  useEffect(() => {
    if (!fontValue.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void isLocalFontAvailable(fontValue.trim()).then((found) => {
        if (!cancelled) setAvailable(found);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fontValue]);

  return (
    <>
      <Input
        id={id}
        value={fontValue}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setDraft(null);
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        maxLength={80}
        aria-invalid={unavailable}
        aria-describedby={unavailable ? `${id}-warning` : undefined}
        className="min-w-0 bg-background"
      />
      {unavailable && (
        <p id={`${id}-warning`} role="status" className="text-xs text-danger">
          未找到本机字体，当前显示回退字体
        </p>
      )}
    </>
  );
}
