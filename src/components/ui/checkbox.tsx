import * as React from "react"
import { cn } from "@/lib/utils"

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        className={cn(
          "h-4 w-4 shrink-0 rounded border border-primary accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
