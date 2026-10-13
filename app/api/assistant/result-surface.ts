// Builds a read-only A2UI v0.9 table for any tool result that has rows
// (YouTrack MCP results and list_backlog_issues alike), using this app's own
// ResultTable component (app catalog below; React view in
// app/(pm)/assistant/result-table.tsx). Pure: every cell is built from the
// real tool result, never from model text.
import { z } from "zod/v3";
import type { ComponentApi } from "@a2ui/web_core/v0_9";
export type A2uiSurfaceMessages = { surfaceId: string; messages: unknown[] };

export type SourceRow = Record<string, unknown>;

export const APP_CATALOG_ID = "https://pm.local/a2ui/catalogs/assistant/v1.json";

const resultTableSchema = z
  .object({
    title: z.string(),
    columns: z.array(z.string()),
    // Columns rendered as pills (Type, State, ...).
    badgeColumns: z.array(z.string()).optional(),
    rows: z.array(
      z.object({
        cells: z.array(z.string()),
        href: z.string().optional(),
        // Selection mode only: the value sent back, and rows that can't be picked.
        id: z.string().optional(),
        disabledReason: z.string().optional(),
      }),
    ),
    // Turns the table into a picker: checkboxes plus one button that
    // dispatches `event` with context `{ ids, labels }`.
    select: z
      .object({
        event: z.string(),
        buttonLabel: z.string(),
        preselect: z.boolean(),
        // Set when the button can't be used at all (e.g. no active Sprint).
        blockedReason: z.string().optional(),
      })
      .optional(),
  })
  .strict();

export type ResultTableProps = z.infer<typeof resultTableSchema>;

// zod/v3, not zod 4: @a2ui/web_core walks schemas by `_def.typeName`, which
// only v3 schemas carry. It's the app's copy of zod 3, not A2UI's nested one,
// so the types differ nominally -- hence the one cast here.
export const ResultTableApi = { name: "ResultTable", schema: resultTableSchema } as unknown as ComponentApi;

// Enough to scan; the model still gets the full (char-capped) result.
const MAX_SURFACE_ROWS = 50;
const MAX_COLUMNS = 6;
const LEAD_KEYS = ["id", "idReadable", "login", "shortName", "summary", "name", "title", "fullName"];
const BADGE_KEYS = new Set(["Type", "State", "Priority", "type", "state", "priority", "status"]);

function isRowArray(value: unknown): value is SourceRow[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))
  );
}

// A tool result is either directly an array of records, or a wrapper object
// with one property that is (e.g. YouTrack search_issues' `{issuesPage:
// [...], hasNextPage}`) -- checked generically, not by name, so this works
// for any tool's list-shaped result, not just search_issues.
function findRowArray(value: unknown): SourceRow[] | null {
  if (isRowArray(value)) {
    return value;
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const nested of Object.values(value)) {
      if (isRowArray(nested)) {
        return nested;
      }
    }
  }
  return null;
}

// The raw MCP tool result is `Array<{type, text}>`, with the actual payload
// JSON-encoded inside each block's `text` string -- unwrap that before
// looking for a row array.
function unwrapPayloads(value: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  // Unwrapped payloads first -- the raw MCP envelope itself
  // (`[{type:"text",text:"..."}]`) is also technically an array of
  // records, but the actual tool data nested inside `text` is what should
  // win whenever it's there.
  const candidates: unknown[] = [];
  if (Array.isArray(parsed)) {
    for (const block of parsed) {
      const text = (block as { text?: unknown } | null)?.text;
      if (typeof text === "string") {
        try {
          candidates.push(JSON.parse(text));
        } catch {
          // Not JSON -- ignore, the raw-JSON fallback view still covers it.
        }
      }
    }
  }
  if (candidates.length === 0) candidates.push(parsed);
  return candidates;
}

function extractSourceRows(value: string): SourceRow[] | null {
  const candidates = unwrapPayloads(value);
  for (const candidate of candidates) {
    const rows = findRowArray(candidate);
    if (rows) return rows;
  }
  // A single record (e.g. get_current_user) -- one row, not the envelope.
  const record = candidates.find(
    (candidate): candidate is SourceRow =>
      candidate !== null && typeof candidate === "object" && !Array.isArray(candidate),
  );
  return record ? [record] : null;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

// One level of nested plain-object fields (YouTrack's customFields, e.g.
// {Priority, Type, State}) is flattened into its own columns instead of
// showing as an unreadable "[object Object]" cell.
function flattenRow(row: SourceRow): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        flat[subKey] = formatCellValue(subValue);
      }
    } else {
      flat[key] = formatCellValue(value);
    }
  }
  return flat;
}

function isDisplayable(key: string, value: string): boolean {
  return !key.startsWith("$") && !isHttpUrl(value) && !/^[[{]/.test(value);
}

// ISO timestamps read as dates.
function cellText(value: string): string {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : value;
}

function countLabel(shown: number, total: number, more: boolean): string {
  if (more) return `${shown} shown · more available`;
  if (total > shown) return `${shown} of ${total} shown`;
  return `${total} ${total === 1 ? "result" : "results"}`;
}

// The A2UI messages for one ResultTable surface.
export function tableSurface(surfaceId: string, props: ResultTableProps): A2uiSurfaceMessages {
  return {
    surfaceId,
    messages: [
      { version: "v0.9", createSurface: { surfaceId, catalogId: APP_CATALOG_ID } },
      { version: "v0.9", updateComponents: { surfaceId, components: [{ id: "root", component: "ResultTable", ...props }] } },
    ],
  };
}

export function buildResultSurface(
  surfaceId: string,
  toolName: string,
  result: unknown,
): { surface: A2uiSurfaceMessages; summary: string } | null {
  const json = JSON.stringify(result);
  const rows = extractSourceRows(json);
  if (!rows) return null;
  // A wrapper's own counts (`total`, search_issues' `hasNextPage`) beat the
  // row count -- the rows may be just one page or a capped slice.
  const meta = (unwrapPayloads(json).find((c) => c !== null && typeof c === "object" && !Array.isArray(c)) ?? {}) as SourceRow;
  const flat = rows.slice(0, MAX_SURFACE_ROWS).map(flattenRow);

  // Columns: identity/name first, then whatever else has a displayable value
  // in at least one row, capped so the table stays readable.
  const keys = Array.from(new Set(flat.flatMap((row) => Object.keys(row)))).filter((key) =>
    flat.some((row) => row[key] && isDisplayable(key, row[key])),
  );
  const columns = [...LEAD_KEYS.filter((key) => keys.includes(key)), ...keys.filter((key) => !LEAD_KEYS.includes(key))].slice(
    0,
    MAX_COLUMNS,
  );

  const summary = countLabel(flat.length, typeof meta.total === "number" ? meta.total : rows.length, meta.hasNextPage === true);
  const props: ResultTableProps = {
    title: `${summary} · ${toolName.replaceAll("_", " ")}`,
    columns,
    badgeColumns: columns.filter((key) => BADGE_KEYS.has(key)),
    rows: flat.map((row) => {
      const href = Object.values(row).find(isHttpUrl);
      const cells = columns.map((key) => (row[key] && isDisplayable(key, row[key]) ? cellText(row[key]) : ""));
      return href ? { cells, href } : { cells };
    }),
  };

  return { surface: tableSurface(surfaceId, props), summary };
}
