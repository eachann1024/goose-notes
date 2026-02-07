import * as React from "react"

interface FileTriggerProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "children" | "onChange" | "value" | "defaultValue"
  > {
  children: React.ReactElement<{
    onClick?: (e: React.MouseEvent<HTMLElement>) => void
  }>
  onFileChange?: (file: File | null, event: React.ChangeEvent<HTMLInputElement>) => void
  resetAfterSelect?: boolean
}

export function FileTrigger({
  children,
  onFileChange,
  resetAfterSelect = true,
  ...inputProps
}: FileTriggerProps) {
  const inputId = useId()

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
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      const originalOnClick = children.props.onClick
      originalOnClick?.(event)
      if (!event.defaultPrevented) {
        const input = document.getElementById(inputId) as HTMLInputElement | null
        input?.click()
      }
    },
  })

  return (
    <>
      <input
        id={inputId}
        type="file"
        className="hidden"
        onChange={handleChange}
        {...inputProps}
      />
      {child}
    </>
  )
}
