"use client";

import { useFormStatus } from "react-dom";

// pending stays true through the server action AND its redirect("/"), so the
// button stays disabled until the home page lands.
export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Redirecting…" : "Sign in"}
    </button>
  );
}
