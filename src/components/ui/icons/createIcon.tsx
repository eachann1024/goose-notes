import { forwardRef, type ComponentType, type SVGProps } from "react";
import type { IconProps } from "@phosphor-icons/react";

export type GooseIconProps = SVGProps<SVGSVGElement> & { size?: number | string; absoluteStrokeWidth?: boolean };
export type GooseIcon = ReturnType<typeof createIcon>;
export function createIcon(Glyph: ComponentType<IconProps>, name: string) {
  const Icon = forwardRef<SVGSVGElement, GooseIconProps>(function GooseIcon(
    { className, size = 24, strokeWidth: _strokeWidth, absoluteStrokeWidth: _absoluteStrokeWidth, fill, ...props }, ref,
  ) {
    return <Glyph ref={ref} size={size} weight={fill && fill !== "none" ? "fill" : "regular"}
      aria-hidden={props["aria-label"] || props["aria-labelledby"] ? undefined : true}
      focusable="false" {...props} className={["goose-icon", className].filter(Boolean).join(" ")} />;
  });
  Icon.displayName = `GooseIcon(${name})`;
  return Icon;
}
