import * as React from "react";

import { cn } from "./lib/utils";
import { Label } from "./label";

interface InputFieldProps extends React.ComponentProps<"input"> {
  error?: string;
  label?: string;
  showAsterisk?: boolean;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ className, type, error, label, showAsterisk, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <Label className="text-xs font-medium text-muted-foreground">
            {label}
            {showAsterisk && <span className="text-destructive ml-0.5">*</span>}
          </Label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors",
            error && "border-destructive focus-visible:border-destructive",
            className,
          )}
          ref={ref}
          aria-invalid={!!error}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  },
);
InputField.displayName = "InputField";

export { InputField, type InputFieldProps };
