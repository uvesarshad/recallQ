"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordFieldProps = {
  id: string;
  name: string;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
};

export default function PasswordField({
  id,
  name,
  placeholder,
  autoComplete,
  required,
  minLength,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="w-full rounded-input border border-border bg-surface-2 py-2 pl-3 pr-11 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand-glow"
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-buttons text-text-muted transition-colors hover:bg-bg hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  );
}
