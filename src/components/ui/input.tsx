import * as React from "react"
import { Input as HeroInput } from "@heroui/react"

/**
 * 外壳基础控件：内部改为基于 @heroui/react 的 Input（React Aria 的受控原生 input）。
 * 业务契约零改动：仍是原生 <input> props 形态（type/value/onChange(e)/placeholder/
 * disabled/id/autoFocus/onKeyDown/autoComplete/ref…）；className 还原原 shadcn 视觉。
 * RAC 的 Input 即真实 <input>，onChange 走原生事件，e.target.value 照常可用。
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <HeroInput
        type={type}
        data-slot="input"
        className={cn(
          "flex h-10 w-full rounded-[10px] border border-transparent bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
