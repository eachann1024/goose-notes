import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FileTriggerProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "children" | "onChange" | "value" | "defaultValue"
  > {
  children: React.ReactElement<{
    onClick?: (e: React.MouseEvent<HTMLElement>) => void
    disabled?: boolean
  }>
  onFileChange?: (file: File | null, event: React.ChangeEvent<HTMLInputElement>) => void
  resetAfterSelect?: boolean
  helperText?: string
  errorText?: string | null
  disabledReason?: string
}

export function FileTrigger({
  children,
  onFileChange,
  resetAfterSelect = true,
  helperText,
  errorText,
  disabledReason,
  ...inputProps
}: FileTriggerProps) {
  const inputId = useId()
  const isDisabled = Boolean(inputProps.disabled)

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null
      onFileChange?.(file, event)
      if (resetAfterSelect) {
        event.target.value = ""
      }
    },
    [onFileChange, resetAfterSelect]
  )

  const child = React.cloneElement(children, {
    disabled: isDisabled || children.props.disabled,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      if (isDisabled) {
        event.preventDefault()
        return
      }
      const originalOnClick = children.props.onClick
      originalOnClick?.(event)
      if (!event.defaultPrevented) {
        const input = document.getElementById(inputId) as HTMLInputElement | null
        input?.click()
      }
    },
  })

  const triggerContent =
    isDisabled && disabledReason ? (
      <TooltipProvider delayDuration={600}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block w-full cursor-not-allowed">{child}</span>
          </TooltipTrigger>
          <TooltipContent side="top">{disabledReason}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      child
    )

  return (
    <div className="w-full">
      <input
        id={inputId}
        type="file"
        className="hidden"
        onChange={handleChange}
        {...inputProps}
      />
      {triggerContent}
      {errorText ? (
        <p className="mt-2 rounded-[12px] bg-[var(--goose-color-danger-subtle-bg)] px-3 py-2 text-sm text-[var(--goose-color-danger)]">
          {errorText}
        </p>
      ) : helperText ? (
        <p className="mt-2 px-1 text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  )
}
