"use client";

import * as React from "react";

import { cn } from "../lib/utils";
import { Label } from "../label";
import { Icon } from "../icon";

interface InputFieldProps extends React.ComponentProps<"input"> {
  error?: string;
  label?: string;
  showAsterisk?: boolean;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ className, type, error, label, showAsterisk, ...props }, ref) => {
    return (
      <div className="w-full">
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

interface PasswordFieldProps extends Omit<React.ComponentProps<"input">, "type"> {
  error?: string;
  label?: string;
}

const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, error, label, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className="relative w-full">
        {label && (
          <Label className="text-xs font-medium text-muted-foreground">
            {label}
          </Label>
        )}
        <input
          type={showPassword ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors",
            error && "border-destructive focus-visible:border-destructive",
            className,
          )}
          ref={ref}
          aria-invalid={!!error}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <Icon name="EyeOff" className="h-4 w-4" />
          ) : (
            <Icon name="Eye" className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  },
);
PasswordField.displayName = "PasswordField";

export { InputField, PasswordField, type InputFieldProps, type PasswordFieldProps };
