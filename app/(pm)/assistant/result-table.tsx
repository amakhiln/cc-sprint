"use client";

// The app's own A2UI catalog: ResultTable (plus the standard components in
// a2ui-components.tsx), rendered with the
// app's styles. Read-only for tool results; with `select` it's the issue
// picker (checkboxes + one button that dispatches an A2UI action). Its schema
// and the server-side builders live in app/api/assistant/result-surface.ts
// and picker-surface.ts.
import { createContext, useContext, useEffect, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { createComponentImplementation } from "@a2ui/react/v0_9";
import { Catalog, type ComponentContext } from "@a2ui/web_core/v0_9";
import { Button } from "@/components/ui/button";
import { APP_CATALOG_ID, ResultTableApi, type ResultTableProps } from "@/app/api/assistant/result-surface";
import { A2UI_BASIC_COMPONENTS } from "./a2ui-components";

const HEADER_LABELS: Record<string, string> = { id: "ID", idReadable: "ID", estimateHours: "Estimate (h)" };

// "createdAt" -> "Created at"; known keys get a hand-picked label.
function headerLabel(key: string): string {
  if (HEADER_LABELS[key]) return HEADER_LABELS[key];
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type PickRowStatus = { status: "added" | "already" | "failed"; message?: string };

// Picker state owned by assistant-surface.tsx (outside A2UI): per-row add
// results, whether an add is in flight, and where to report the ticked ids
// (so a chat message can say "add the selected ones"). Added rows lock and
// show a check.
export const PickContext = createContext<{
  statuses: ReadonlyMap<string, PickRowStatus>;
  adding: boolean;
  onSelectionChange?: (ids: string[]) => void;
}>({ statuses: new Map(), adding: false });

const CHECKBOX = "size-4 cursor-pointer accent-[color:var(--accent-peach)] disabled:cursor-not-allowed disabled:opacity-40";

function ResultTableView({ props, context }: { props: ResultTableProps; context: ComponentContext }) {
  const badges = new Set(props.badgeColumns ?? []);
  const select = props.select;
  const { statuses, adding, onSelectionChange } = useContext(PickContext);
  const inSprint = (id: string | undefined) => {
    const status = id ? statuses.get(id)?.status : undefined;
    return status === "added" || status === "already";
  };
  const pickable = props.rows.filter((row) => row.id && !row.disabledReason && !inSprint(row.id)).map((row) => row.id!);
  const [ticked, setSelected] = useState<Set<string>>(() => new Set(select?.preselect ? pickable : []));
  // Rows that just went into the Sprint drop out of the selection on their own.
  const selected = new Set(pickable.filter((id) => ticked.has(id)));
  const allSelected = pickable.length > 0 && pickable.every((id) => selected.has(id));
  const selectedKey = [...selected].join(",");
  useEffect(() => {
    if (select) onSelectionChange?.(selectedKey ? selectedKey.split(",") : []);
  }, [select, selectedKey, onSelectionChange]);
  // A picker that's replaced or cleared no longer counts as "selected".
  useEffect(() => () => onSelectionChange?.([]), [onSelectionChange]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (!select) return;
    void context.dispatchAction({ event: { name: select.event, context: { ids: [...selected] } } });
  }

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs text-muted-foreground">{props.title}</figcaption>
      <div className="overflow-hidden rounded-md border border-[color:var(--border-glass)]">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-[color:var(--surface-glass-strong)]">
            <tr>
              {select && (
                <th scope="col" className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={pickable.length === 0}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(pickable))}
                    aria-label="Select all"
                    className={CHECKBOX}
                  />
                </th>
              )}
              {props.columns.map((column) => (
                <th key={column} scope="col" className="px-3 py-2 font-medium text-muted-foreground">
                  {headerLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, rowIndex) => (
              <tr
                key={row.id ?? rowIndex}
                title={row.disabledReason ?? (row.id ? statuses.get(row.id)?.message : undefined)}
                className={`border-t border-[color:var(--border-glass)] transition-colors ${
                  inSprint(row.id)
                    ? "bg-[color:var(--accent-mint)]/10"
                    : `hover:bg-[color:var(--surface-glass)] ${row.disabledReason ? "opacity-60" : ""}`
                }`}
              >
                {select && (
                  <td className="px-3 py-2 align-top">
                    {inSprint(row.id) ? (
                      <CircleCheck aria-label="In the Sprint" className="size-4 text-[color:var(--accent-mint)]" />
                    ) : row.id && statuses.get(row.id)?.status === "failed" ? (
                      <span className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id!)}
                          aria-label={`Select ${row.id} (last add failed)`}
                          className={CHECKBOX}
                        />
                        <CircleAlert aria-hidden="true" className="size-3.5 text-destructive" />
                      </span>
                    ) : row.id && (
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        disabled={!!row.disabledReason}
                        onChange={() => toggle(row.id!)}
                        aria-label={row.disabledReason ? `${row.id}: ${row.disabledReason}` : `Select ${row.id}`}
                        className={CHECKBOX}
                      />
                    )}
                  </td>
                )}
                {row.cells.map((cell, cellIndex) => {
                  const column = props.columns[cellIndex];
                  return (
                    <td
                      key={cellIndex}
                      className={`px-3 py-2 align-top ${cellIndex === 0 ? "font-medium whitespace-nowrap text-foreground" : "text-foreground/90 [overflow-wrap:anywhere]"}`}
                    >
                      {cellIndex === 0 && row.href ? (
                        <a href={row.href} target="_blank" rel="noopener noreferrer" className="text-[color:var(--accent-mint)] underline underline-offset-2">
                          {cell}
                        </a>
                      ) : cell && badges.has(column) ? (
                        <span className="inline-block rounded-full bg-[color:var(--surface-glass-strong)] px-2 py-0.5 ring-1 ring-[color:var(--border-glass)]">
                          {cell}
                        </span>
                      ) : cell ? (
                        cell
                      ) : (
                        <span className="text-muted-foreground" aria-label="empty">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {select && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={submit} disabled={adding || selected.size === 0 || !!select.blockedReason}>
            {adding ? "Adding…" : `${select.buttonLabel}${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </Button>
          {select.blockedReason && <span className="text-xs text-muted-foreground">{select.blockedReason}</span>}
        </div>
      )}
    </figure>
  );
}

export const ResultTable = createComponentImplementation(ResultTableApi, ({ props, context }) => (
  <ResultTableView props={props as ResultTableProps} context={context} />
));

// ResultTable plus app-styled renderers of A2UI's standard components.
export const appCatalog = new Catalog(APP_CATALOG_ID, "0.9", [ResultTable, ...A2UI_BASIC_COMPONENTS]);
