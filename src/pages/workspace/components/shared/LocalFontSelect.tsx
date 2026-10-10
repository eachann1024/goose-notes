import { useEffect, useState } from "react";
import { ChevronDown } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SYSTEM_FONT_STACK, toCssFontFamily } from "@/lib/fontLoader";
import {
  getAvailableLocalFonts,
  probeLocalFont,
  type LocalFontOption,
} from "@/lib/localFontOptions";

const DEFAULT_VALUE = "__goose_system_default__";

export function LocalFontSelect({
  id,
  label,
  value,
  onChange,
  defaultLabel = "默认",
  defaultFontFamily = SYSTEM_FONT_STACK,
  modes = [],
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  defaultLabel?: string;
  defaultFontFamily?: string;
  modes?: LocalFontOption[];
}) {
  const [fonts, setFonts] = useState<LocalFontOption[] | null>(null);
  const [savedFont, setSavedFont] = useState<{
    family: string;
    available: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void getAvailableLocalFonts().then((available) => {
      if (active) setFonts(available);
    });
    return () => {
      active = false;
    };
  }, []);
  const isMode = modes.some((option) => option.family === value);
  useEffect(() => {
    if (!value || isMode) return;
    let active = true;
    void probeLocalFont(value).then((available) => {
      if (active) setSavedFont({ family: value, available });
    });
    return () => {
      active = false;
    };
  }, [value, isMode]);
  const selectedOption = [...modes, ...(fonts ?? [])].find(
    (option) => option.family === value,
  );
  const availability = selectedOption
    ? true
    : savedFont?.family === value
      ? savedFont.available
      : undefined;
  const selectedName = value
    ? selectedOption &&
      !isMode &&
      selectedOption.label !== selectedOption.family
      ? `${selectedOption.label} · ${selectedOption.family}`
      : (selectedOption?.label ?? value)
    : defaultLabel;
  const fallback = Boolean(value && availability === false);
  const selectedFamily =
    !value || fallback || availability === undefined
      ? defaultFontFamily
      : `${toCssFontFamily(value)}, ${defaultFontFamily}`;
  const options = [...modes, ...(fonts ?? [])];
  if (value && availability === true && !selectedOption)
    options.push({ family: value, label: value });

  return (
    <div className="min-w-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-label={`${label}：${selectedName}${fallback ? "，未安装，已回退" : ""}`}
            className="h-auto min-h-11 w-full min-w-0 justify-between gap-3 border-input px-3 py-2 font-normal text-foreground"
          >
            <span
              className="min-w-0 text-left"
              style={{ fontFamily: selectedFamily }}
            >
              <span className="block truncate">{selectedName}</span>
              <span className="block text-xs text-muted-foreground">
                {fallback
                  ? "本机未找到，已使用默认字体"
                  : value && availability === undefined
                    ? "正在确认本机字体…"
                    : "你好 · Aa"}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          aria-label={label}
          className="max-h-80 min-w-[var(--trigger-width)] overflow-y-auto"
        >
          <DropdownMenuRadioGroup
            value={value ?? DEFAULT_VALUE}
            onValueChange={(next) =>
              onChange(next === DEFAULT_VALUE ? null : next)
            }
          >
            <DropdownMenuRadioItem
              value={DEFAULT_VALUE}
              style={{ fontFamily: defaultFontFamily }}
            >
              {defaultLabel} · 你好 Aa
            </DropdownMenuRadioItem>
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={option.family}
                value={option.family}
                style={{
                  fontFamily: `${toCssFontFamily(option.family)}, ${defaultFontFamily}`,
                }}
              >
                <span>
                  <span className="block">{option.label} · 你好 Aa</span>
                  {!modes.some((mode) => mode.family === option.family) &&
                    option.label !== option.family && (
                      <span className="block text-xs text-muted-foreground">
                        {option.family}
                      </span>
                    )}
                </span>
              </DropdownMenuRadioItem>
            ))}
            {fallback && (
              <DropdownMenuRadioItem value={value!} disabled>
                {value}（未安装，已回退）
              </DropdownMenuRadioItem>
            )}
            {fonts === null && (
              <DropdownMenuRadioItem value="__loading__" disabled>
                正在检测可用的本机字体…
              </DropdownMenuRadioItem>
            )}
            {fonts?.length === 0 && (
              <DropdownMenuRadioItem value="__empty__" disabled>
                未检测到列表中的本机字体，可选择默认。
              </DropdownMenuRadioItem>
            )}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
