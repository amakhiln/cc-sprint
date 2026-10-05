"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordInput({ invalid }: { invalid: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id="password"
        type={visible ? "text" : "password"}
        name="password"
        required
        autoFocus
        autoComplete="current-password"
        aria-invalid={invalid || undefined}
        className="w-full rounded-sm border border-border bg-white/40 py-2 pr-10 pl-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center rounded-r-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
      </button>
    </div>
  );
}
