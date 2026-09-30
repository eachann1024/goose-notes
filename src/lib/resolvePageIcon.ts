import * as GooseIcons from "@/components/ui/icons";
import * as LegacyIcons from "lucide-react";
import type { ComponentType, SVGProps } from "react";
type PageIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;
/** Never rewrite a saved icon key. Known keys use Phosphor; older custom keys remain readable. */
export function resolvePageIcon(name: string | undefined): PageIcon | null {
  if (!name) return null;
  return (GooseIcons as unknown as Record<string, PageIcon>)[name]
    ?? (LegacyIcons as unknown as Record<string, PageIcon>)[name]
    ?? null;
}
