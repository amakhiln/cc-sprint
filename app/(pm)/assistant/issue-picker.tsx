"use client";

// Renders the assistant's A2UI issue picker (built server-side in
// app/api/assistant/picker-surface.ts). Client-only: @a2ui/react isn't
// SSR-safe, so assistant-chat.tsx loads this via next/dynamic {ssr:false}.
// Nothing here is persisted -- the surface lives in this component's memory.
import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { A2uiSurface, basicCatalog, type ReactComponentImplementation } from "@a2ui/react/v0_9";
import { MessageProcessor, type ActionPayload } from "@a2ui/web_core/v0_9";
import { addIssuesToActiveSprintAction } from "@/app/actions/assistant-sprint";
import type { AddIssuesToActiveSprintResult } from "@/app/api/assistant/agent-tool-logic";
import { ADD_TO_SPRINT_EVENT, tickedIssueIds } from "@/app/api/assistant/picker-surface";

// Themed via the basic catalog's --a2ui-* custom properties (A2uiSurface
// takes no className). @a2ui/react 0.12 ships its CSS-module class maps empty,
// so the button and checkboxes are also styled by descendant selectors on the
// wrapper below.
const THEME = {
  "--a2ui-color-primary": "var(--accent-peach)",
  "--a2ui-color-primary-hover": "var(--accent-peach)",
  "--a2ui-color-on-primary": "#1f1a17",
  "--a2ui-color-on-background": "var(--foreground)",
  "--a2ui-text-caption-color": "var(--ink-muted)",
  "--a2ui-checkbox-label-font-weight": "400",
  "--a2ui-font-family-title": "inherit",
} as CSSProperties;

// The A2UI Button can't be disabled from here -- a surface id in this set
// ignores Add clicks while its add is in flight and after one has succeeded
// (a resubmit would only report every row as "already in the Sprint").
const lockedSurfaces = new Set<string>();

const STATUS_TEXT = { added: "Added", already: "Already in the Sprint", failed: "Failed" } as const;

export function IssuePicker({ surface }: { surface: unknown }) {
  const [result, setResult] = useState<AddIssuesToActiveSprintResult | null>(null);
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const [adding, startAdding] = useTransition();

  const model = useMemo(() => {
    const { surfaceId, messages } = (surface ?? {}) as { surfaceId?: unknown; messages?: unknown };
    if (typeof surfaceId !== "string" || !Array.isArray(messages)) return null;
    const onAction = (action: ActionPayload) => {
      if (action.name !== ADD_TO_SPRINT_EVENT || lockedSurfaces.has(surfaceId)) return;
      const ids = tickedIssueIds(action.context.issues);
      if (ids.length === 0) {
        setResult({ ok: false, error: "Tick at least one issue to add." });
        return;
      }
      const rows = Array.isArray(action.context.issues) ? (action.context.issues as { id?: unknown; label?: unknown }[]) : [];
      setLabels(new Map(rows.filter((row) => typeof row?.id === "string" && typeof row.label === "string").map((row) => [row.id as string, row.label as string])));
      lockedSurfaces.add(surfaceId);
      startAdding(async () => {
        let next: AddIssuesToActiveSprintResult;
        try {
          next = await addIssuesToActiveSprintAction(ids);
        } catch {
          next = { ok: false, error: "Failed to add issues. Please try again." };
        }
        if (!next.ok) lockedSurfaces.delete(surfaceId);
        setResult(next);
      });
    };
    try {
      const processor = new MessageProcessor<ReactComponentImplementation>([basicCatalog], onAction);
      processor.processMessages(messages as never);
      return processor.getSurface(surfaceId) ?? null;
    } catch (error) {
      console.error("Issue picker: invalid A2UI surface", error);
      return null;
    }
  }, [surface]);

  if (!model) {
    return <p className="text-xs text-destructive">Couldn&apos;t show the issue picker.</p>;
  }

  return (
    <div className="glass-row flex flex-col gap-3 p-4 text-sm" aria-busy={adding}>
      <div
        style={THEME}
        className="[&_button]:mt-2 [&_button]:w-fit [&_button]:cursor-pointer [&_button]:rounded-full [&_button]:bg-[color:var(--accent-peach)] [&_button]:px-4 [&_button]:py-1.5 [&_button]:text-sm [&_button]:font-medium [&_button]:text-[#1f1a17] [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50 [&_button_*]:m-0 [&_button_*]:text-sm [&_input[type=checkbox]]:accent-[color:var(--accent-peach)]"
      >
        <A2uiSurface surface={model} />
      </div>
      <p role="status" className="text-xs text-muted-foreground empty:hidden">
        {adding ? "Adding to the Sprint…" : result?.ok ? `Done — ${result.results.filter((row) => row.status === "added").length} added.` : ""}
      </p>
      {result && !result.ok && (
        <p role="alert" className="text-xs text-destructive">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <ul aria-label="Add results" className="flex flex-col gap-1 border-t border-[color:var(--border-glass)] pt-2 text-xs">
          {result.results.map((row) => (
            <li key={row.id} className="flex justify-between gap-3">
              <span className="text-foreground">{labels.get(row.id) ?? row.id}</span>
              <span className={row.status === "failed" ? "shrink-0 text-destructive" : "shrink-0 text-muted-foreground"}>
                {STATUS_TEXT[row.status]}
                {row.message ? ` — ${row.message}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default IssuePicker;
