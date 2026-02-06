import type { ReactNode } from "react";

type SettingsSectionTone = "default" | "danger";

interface SettingsSectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: SettingsSectionTone;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function SettingsSectionCard({
  title,
  description,
  actions,
  tone = "default",
  className,
  contentClassName,
  children,
}: SettingsSectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-[14px] border p-5 transition-colors",
        tone === "danger"
          ? "border-destructive/25 bg-destructive/[0.04] dark:bg-destructive/[0.08]"
          : "border-[hsl(var(--foreground)/0.08)] bg-[hsl(var(--goose-editor-bg))] shadow-[0_6px_18px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      {title || description || actions ? (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
            ) : null}
            {description ? (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      ) : null}

      <div className={cn("space-y-4", contentClassName)}>{children}</div>
    </section>
  );
}
