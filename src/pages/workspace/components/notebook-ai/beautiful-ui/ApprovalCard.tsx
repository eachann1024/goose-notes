import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ApprovalCard({
    title,
    statusLabel,
    statusTone = "neutral",
    children,
    footer,
    className,
}: {
    title: string;
    statusLabel: string;
    statusTone?: "neutral" | "danger" | "success";
    children?: ReactNode;
    footer?: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                "bui-root bui-approval notebook-ai-approval-plan",
                className,
            )}
            aria-label="AI 笔记变更计划"
        >
            <p
                className={cn(
                    "m-0 text-[12px] tracking-[0.08em] text-muted-foreground",
                    statusTone === "danger" &&
                        "text-[var(--goose-color-danger-focus)]",
                    statusTone === "success" &&
                        "text-[var(--goose-color-success)]",
                )}
            >
                {statusLabel}
            </p>
            <h3 className="mt-2 min-w-0 text-[20px] font-semibold leading-tight tracking-[-0.04em] text-foreground">
                {title}
            </h3>
            {children}
            {footer ? <div className="mt-[22px]">{footer}</div> : null}
        </section>
    );
}
