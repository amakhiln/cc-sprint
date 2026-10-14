"use client";

// Renders one assistant A2UI surface with the app catalog (result-table.tsx):
// a read-only result table, the issue picker (picker-surface.ts), whose Add
// action lands here, or the help guide (help.ts), whose Ask actions do. Client-only: @a2ui/react isn't SSR-safe, so
// assistant-chat.tsx loads this via next/dynamic {ssr:false}.
// Nothing here is persisted -- the surface lives in this component's memory.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { A2uiSurface, type ReactComponentImplementation } from "@a2ui/react/v0_9";
import { MessageProcessor, type ActionPayload } from "@a2ui/web_core/v0_9";
import { addIssuesToActiveSprintAction } from "@/app/actions/assistant-sprint";
import type { AddIssuesToActiveSprintResult } from "@/app/api/assistant/agent-tool-logic";
import { ADD_TO_SPRINT_EVENT, pickedIssueIds } from "@/app/api/assistant/picker-surface";
import { ASK_EVENT } from "@/app/api/assistant/help";
import { appCatalog, PickContext, type PickRowStatus } from "./result-table";
import { AskContext } from "./a2ui-components";

// A surface id in this set ignores Add clicks while its add is in flight.
// Added rows can't be re-ticked, so a later Add only ever sends new rows.
const lockedSurfaces = new Set<string>();

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// The outcome of the latest Add, as a banner: what landed, what was already
// there, and what failed (with why).
function AddResultBanner({ result }: { result: AddIssuesToActiveSprintResult }) {
  if (!result.ok) {
    return (
      <div role="alert" className="flex items-start gap-2.5 rounded-md bg-destructive/10 px-3.5 py-3 text-sm ring-1 ring-destructive/25">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="text-foreground">{result.error}</p>
      </div>
    );
  }
  const added = result.results.filter((row) => row.status === "added");
  const already = result.results.filter((row) => row.status === "already");
  const failed = result.results.filter((row) => row.status === "failed");
  return (
    <div role="status" className="flex flex-col gap-2">
      {added.length + already.length > 0 && (
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-md bg-[color:var(--accent-mint)]/12 px-3.5 py-3 ring-1 ring-[color:var(--accent-mint)]/30">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[color:var(--accent-mint)]" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">
              {added.length > 0 ? `${plural(added.length, "issue")} added to the Sprint` : "Already in the Sprint"}
            </p>
            <p className="text-xs text-muted-foreground">
              {[...added, ...already].map((row) => row.id).join(", ")}
              {added.length > 0 && already.length > 0 ? ` · ${already.length} already there` : ""}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 self-center text-xs font-medium text-foreground underline-offset-2 hover:underline"
          >
            Open Sprint Plan
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      )}
      {failed.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-md bg-destructive/10 px-3.5 py-3 ring-1 ring-destructive/25">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-medium text-foreground">{plural(failed.length, "issue")} couldn&apos;t be added</p>
            <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {failed.map((row) => (
                <li key={row.id}>
                  <span className="font-medium text-foreground">{row.id}</span>
                  {row.message ? ` — ${row.message}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function AssistantSurface({
  surface,
  onSelectionChange,
  onAsk,
  askDisabled = false,
}: {
  surface: unknown;
  // Ticked ids of this surface's picker, reported up to the chat.
  onSelectionChange?: (surfaceId: string, ids: string[]) => void;
  // A surface Button's `ask` action (help guide) sends its question here.
  onAsk?: (question: string) => void;
  askDisabled?: boolean;
}) {
  // An `ask` action, numbered so asking the same question twice still fires;
  // handed to onAsk from an effect so the surface model never depends on it.
  const [asked, setAsked] = useState<{ question: string; n: number } | null>(null);
  const handledAsk = useRef(0);
  useEffect(() => {
    if (!asked || asked.n === handledAsk.current) return;
    handledAsk.current = asked.n;
    onAsk?.(asked.question);
  }, [asked, onAsk]);
  const [result, setResult] = useState<AddIssuesToActiveSprintResult | null>(null);
  // Every row's latest add outcome, across repeated Adds on this surface.
  const [statuses, setStatuses] = useState<ReadonlyMap<string, PickRowStatus>>(new Map());
  const [adding, startAdding] = useTransition();

  const model = useMemo(() => {
    const { surfaceId, messages } = (surface ?? {}) as { surfaceId?: unknown; messages?: unknown };
    if (typeof surfaceId !== "string" || !Array.isArray(messages)) return null;
    const onAction = (action: ActionPayload) => {
      if (action.name === ASK_EVENT) {
        const question = action.context.question;
        if (typeof question === "string" && question.trim()) setAsked((prev) => ({ question, n: (prev?.n ?? 0) + 1 }));
        return;
      }
      if (action.name !== ADD_TO_SPRINT_EVENT || lockedSurfaces.has(surfaceId)) return;
      const ids = pickedIssueIds(action.context.ids);
      if (ids.length === 0) {
        setResult({ ok: false, error: "Tick at least one issue to add." });
        return;
      }
      lockedSurfaces.add(surfaceId);
      startAdding(async () => {
        let next: AddIssuesToActiveSprintResult;
        try {
          next = await addIssuesToActiveSprintAction(ids);
        } catch {
          next = { ok: false, error: "Failed to add issues. Please try again." };
        }
        lockedSurfaces.delete(surfaceId);
        setResult(next);
        if (next.ok) {
          setStatuses((prev) => {
            const merged = new Map(prev);
            for (const row of next.results) merged.set(row.id, { status: row.status, message: row.message });
            return merged;
          });
        }
      });
    };
    try {
      const processor = new MessageProcessor<ReactComponentImplementation>([appCatalog], onAction);
      processor.processMessages(messages as never);
      return processor.getSurface(surfaceId) ?? null;
    } catch (error) {
      console.error("Assistant surface: invalid A2UI surface", error);
      return null;
    }
  }, [surface]);

  const id = (surface as { surfaceId?: unknown } | null)?.surfaceId;
  const pickContext = useMemo(
    () => ({
      statuses,
      adding,
      onSelectionChange: typeof id === "string" && onSelectionChange ? (ids: string[]) => onSelectionChange(id, ids) : undefined,
    }),
    [statuses, adding, id, onSelectionChange],
  );

  const askContext = useMemo(() => ({ disabled: askDisabled || !onAsk }), [askDisabled, onAsk]);

  if (!model) {
    return <p className="text-xs text-destructive">Couldn&apos;t show this result.</p>;
  }

  return (
    <div className="glass-row flex flex-col gap-3 p-4 text-sm" aria-busy={adding}>
      <AskContext.Provider value={askContext}>
        <PickContext.Provider value={pickContext}>
          <A2uiSurface surface={model} />
        </PickContext.Provider>
      </AskContext.Provider>
      {result && !adding && <AddResultBanner result={result} />}
    </div>
  );
}

export default AssistantSurface;
