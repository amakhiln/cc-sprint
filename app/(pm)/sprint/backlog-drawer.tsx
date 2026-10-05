"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/status-chip";
import { listBacklogIssuesAction, listSubItemsAction } from "@/app/actions/youtrack";
import { pullBacklogIssueAction, assignBacklogIssueAction } from "@/app/actions/backlog-issues";
import { NOT_CONFIGURED_MESSAGE, type YouTrackIssueSummary } from "@/domain/youtrack";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "not-configured" }
  | { status: "error"; message: string }
  | { status: "loaded"; issues: YouTrackIssueSummary[]; truncated: boolean; rollups: Record<string, number> };

// Per parent issue, fetched lazily on first expand and cached until the
// drawer is reopened.
type SubItemsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; items: YouTrackIssueSummary[] };

// Keyed by youtrackIssueId (matches YouTrackIssueSummary.id from the browse
// list) -- backlogIssueId is the persisted row's own id, needed to call
// assignBacklogIssueAction (Story 3.4).
type PulledInfo = { backlogIssueId: string; assigneeId: string | null };

// YouTrack's assignee is a full name/login (e.g. "Harikrishna K"); Team
// Members in this app are named by first name/nickname ("Hari") -- a
// case-insensitive substring match is enough to auto-fill the common case
// without requiring an exact YouTrack-login-to-Team-Member mapping table.
// A parent's rolled-up total from its sub-items, with its own YouTrack
// estimate alongside when set -- estimates belong on leaf issues, so a
// mismatch here flags a parent that still carries one of its own.
function RolledUpEstimate({ total, own }: { total: number; own: number | null }) {
  return (
    <span className="shrink-0">
      Total <span className="font-heading text-foreground">{total.toFixed(1)}h</span>
      {own !== null && <span> · own {own.toFixed(1)}h</span>}
    </span>
  );
}

function matchTeamMemberByName(
  assigneeName: string | null,
  teamMembers: { id: string; name: string }[],
): string | null {
  if (!assigneeName) return null;
  const lowerAssignee = assigneeName.toLowerCase();
  return teamMembers.find((member) => lowerAssignee.includes(member.name.toLowerCase()))?.id ?? null;
}

export function BacklogDrawer({
  activeSprintId,
  pulledIssues,
  teamMembers,
}: {
  activeSprintId: string | null;
  pulledIssues: { youtrackIssueId: string; id: string; assigneeId: string | null }[];
  teamMembers: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [pulledByYoutrackId, setPulledByYoutrackId] = useState<Map<string, PulledInfo>>(
    () => new Map(pulledIssues.map((issue) => [issue.youtrackIssueId, { backlogIssueId: issue.id, assigneeId: issue.assigneeId }])),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // null means the "All" tab -- otherwise one Type value (Story, Task,
  // Sub-task, ...), derived from whatever the loaded issues actually have
  // rather than a fixed list, since every YouTrack project defines its own
  // set of type names.
  const [activeType, setActiveType] = useState<string | null>(null);
  // ponytail: client-side filter over the loaded page only (PAGE_SIZE in
  // infrastructure/youtrack/issues.ts); send it to YouTrack's query if
  // issues past that page need to be findable.
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [subItems, setSubItems] = useState<Record<string, SubItemsState>>({});
  const [pullErrors, setPullErrors] = useState<Record<string, string>>({});
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({});
  const [assigningIds, setAssigningIds] = useState<Set<string>>(new Set());
  const [pulling, setPulling] = useState(false);
  const [, startTransition] = useTransition();
  const isMounted = useRef(true);
  useEffect(() => {
    // Set true on every mount, not just via the useRef initializer -- React's
    // dev-mode double effect invocation (mount, cleanup, mount) runs the
    // cleanup below once before this ever unmounts for real, and without
    // this line that leaves isMounted permanently false for the rest of the
    // component's life.
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Refetch on every open, not just the first -- a previous error, a
    // "not connected" result, or the backlog itself may no longer be
    // accurate by the time the drawer is reopened.
    if (next) {
      setState({ status: "loading" });
      setSelected(new Set());
      setActiveType(null);
      setSearch("");
      setExpandedIds(new Set());
      setSubItems({});
      setPullErrors({});
      setAssignErrors({});
      startTransition(async () => {
        try {
          const result = await listBacklogIssuesAction();
          if (!isMounted.current) return;
          if (result.ok) {
            setState({ status: "loaded", issues: result.data, truncated: result.truncated, rollups: result.rollups });

            // Backfill: an issue pulled before this auto-match existed (or
            // pulled elsewhere) sits Unassigned even though YouTrack already
            // names its assignee -- catch those up too, not just new pulls.
            const backfillable = Array.from(pulledByYoutrackId.entries()).filter(([, info]) => !info.assigneeId);
            if (backfillable.length > 0) {
              const issueById = new Map(result.data.map((issue) => [issue.id, issue]));
              const matches = await Promise.all(
                backfillable.map(async ([youtrackIssueId, info]) => {
                  const matchedId = matchTeamMemberByName(issueById.get(youtrackIssueId)?.assignee ?? null, teamMembers);
                  if (!matchedId) return null;
                  const assignResult = await assignBacklogIssueAction({ issueId: info.backlogIssueId, assigneeId: matchedId });
                  return assignResult.ok ? { youtrackIssueId, assigneeId: matchedId } : null;
                }),
              );
              if (!isMounted.current) return;
              const matched = matches.filter((entry) => entry !== null);
              if (matched.length > 0) {
                setPulledByYoutrackId((prev) => {
                  const nextPulled = new Map(prev);
                  for (const { youtrackIssueId, assigneeId } of matched) {
                    const existing = nextPulled.get(youtrackIssueId);
                    if (existing) nextPulled.set(youtrackIssueId, { ...existing, assigneeId });
                  }
                  return nextPulled;
                });
              }
            }
          } else if (result.error === NOT_CONFIGURED_MESSAGE) {
            setState({ status: "not-configured" });
          } else {
            setState({ status: "error", message: result.error });
          }
        } catch {
          if (!isMounted.current) return;
          setState({ status: "error", message: "Something went wrong. Please try again." });
        }
      });
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSubItems(parentId: string) {
    const isExpanded = expandedIds.has(parentId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (isExpanded) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
    // Retry on re-expand after an error; otherwise fetch only once.
    const current = subItems[parentId];
    if (isExpanded || current?.status === "loading" || current?.status === "loaded") return;
    setSubItems((prev) => ({ ...prev, [parentId]: { status: "loading" } }));
    startTransition(async () => {
      try {
        const result = await listSubItemsAction(parentId);
        if (!isMounted.current) return;
        setSubItems((prev) => ({
          ...prev,
          [parentId]: result.ok ? { status: "loaded", items: result.data } : { status: "error", message: result.error },
        }));
      } catch {
        if (!isMounted.current) return;
        setSubItems((prev) => ({
          ...prev,
          [parentId]: { status: "error", message: "Something went wrong. Please try again." },
        }));
      }
    });
  }

  // YouTrack is the only source of estimates -- no local override. A leaf
  // with no YouTrack estimate can't be pulled until one is set there.
  const estimateById = new Map(
    state.status === "loaded" ? state.issues.map((issue) => [issue.id, issue.estimateHours] as const) : [],
  );
  function hasValidEstimate(id: string): boolean {
    return (estimateById.get(id) ?? 0) > 0;
  }

  const selectedValid = Array.from(selected).filter(hasValidEstimate);
  const canPull = selectedValid.length > 0 && !pulling;

  const availableTypes =
    state.status === "loaded"
      ? Array.from(new Set(state.issues.map((issue) => issue.type).filter((type) => type !== null))).sort()
      : [];
  const searchTerm = search.trim().toLowerCase();
  const visibleIssues =
    state.status === "loaded"
      ? state.issues.filter(
          (issue) =>
            (activeType === null || issue.type === activeType) &&
            (searchTerm === "" ||
              issue.summary.toLowerCase().includes(searchTerm) ||
              issue.id.toLowerCase().includes(searchTerm)),
        )
      : [];

  function handlePullSelected() {
    if (!activeSprintId || state.status !== "loaded" || selectedValid.length === 0) return;
    setPulling(true);
    startTransition(async () => {
      // Server Actions dispatch one at a time per client regardless of
      // Promise.all -- each pull still completes, just sequentially.
      const results = await Promise.all(
        selectedValid.map(async (id) => {
          const issue = (state as { status: "loaded"; issues: YouTrackIssueSummary[] }).issues.find(
            (candidate) => candidate.id === id,
          )!;
          const result = await pullBacklogIssueAction({
            sprintId: activeSprintId,
            youtrackIssueId: issue.id,
            title: issue.summary,
            estimateHours: issue.estimateHours!,
          });
          return { id, result };
        }),
      );
      if (!isMounted.current) return;

      // Auto-fill the assignee when YouTrack's name matches a Team Member,
      // rather than always landing on Unassigned and making the PM redo by
      // hand what YouTrack already told us. Pulling itself still never sets
      // it (Story 3.3) -- this is a second, best-effort write right after.
      const autoAssignments = await Promise.all(
        results.map(async ({ id, result }) => {
          if (!result.ok || result.data.assigneeId) return null;
          const issue = (state as { status: "loaded"; issues: YouTrackIssueSummary[] }).issues.find(
            (candidate) => candidate.id === id,
          );
          const matchedId = issue ? matchTeamMemberByName(issue.assignee, teamMembers) : null;
          if (!matchedId) return null;
          const assignResult = await assignBacklogIssueAction({ issueId: result.data.id, assigneeId: matchedId });
          return assignResult.ok ? { youtrackIssueId: result.data.youtrackIssueId, assigneeId: matchedId } : null;
        }),
      );
      if (!isMounted.current) return;
      const autoAssignedByYoutrackId = new Map(
        autoAssignments.filter((entry) => entry !== null).map((entry) => [entry.youtrackIssueId, entry.assigneeId]),
      );

      setPulling(false);
      setPulledByYoutrackId((prev) => {
        const next = new Map(prev);
        for (const { result } of results) {
          if (result.ok) {
            next.set(result.data.youtrackIssueId, {
              backlogIssueId: result.data.id,
              assigneeId: autoAssignedByYoutrackId.get(result.data.youtrackIssueId) ?? result.data.assigneeId,
            });
          }
        }
        return next;
      });
      setSelected((prev) => {
        const next = new Set(prev);
        for (const { id, result } of results) {
          if (result.ok) next.delete(id);
        }
        return next;
      });
      setPullErrors((prev) => {
        // Merge, don't replace -- a still-checked, not-retried item's error
        // from an earlier batch must survive a later batch that didn't touch it.
        const next = { ...prev };
        for (const { id, result } of results) {
          if (result.ok) {
            delete next[id];
          } else {
            next[id] = result.error;
          }
        }
        return next;
      });
    });
  }

  function handleAssigneeChange(youtrackIssueId: string, backlogIssueId: string, assigneeId: string) {
    const resolvedAssigneeId = assigneeId === "" ? null : assigneeId;
    // Optimistic, and deliberately never reverted on failure -- the PM's
    // just-picked selection stays visible with an inline error alongside it,
    // rather than snapping back to the pre-change value. On success this is
    // already the server-confirmed value; on failure the PM can see exactly
    // what they picked and retry or pick something else.
    setPulledByYoutrackId((prev) => {
      const next = new Map(prev);
      next.set(youtrackIssueId, { backlogIssueId, assigneeId: resolvedAssigneeId });
      return next;
    });
    setAssigningIds((prev) => new Set(prev).add(youtrackIssueId));
    startTransition(async () => {
      try {
        const result = await assignBacklogIssueAction({ issueId: backlogIssueId, assigneeId: resolvedAssigneeId });
        if (!isMounted.current) return;
        if (result.ok) {
          setAssignErrors((prev) => {
            const next = { ...prev };
            delete next[youtrackIssueId];
            return next;
          });
        } else {
          setAssignErrors((prev) => ({ ...prev, [youtrackIssueId]: result.error }));
        }
      } catch {
        if (!isMounted.current) return;
        setAssignErrors((prev) => ({ ...prev, [youtrackIssueId]: "Something went wrong. Please try again." }));
      } finally {
        if (isMounted.current) {
          setAssigningIds((prev) => {
            const next = new Set(prev);
            next.delete(youtrackIssueId);
            return next;
          });
        }
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button type="button">Browse Backlog</Button>
      </SheetTrigger>
      <SheetContent className="data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Backlog</SheetTitle>
          <SheetDescription>
            {activeSprintId
              ? "Select issues to pull them into the active Sprint. Estimates come from YouTrack."
              : "Read-only — browse open YouTrack issues."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
          {state.status === "loading" && (
            <div aria-busy="true" className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading backlog…
            </div>
          )}

          {state.status === "not-configured" && (
            <p className="text-sm text-muted-foreground">
              YouTrack isn&apos;t connected yet.{" "}
              <a href="/settings" className="cursor-pointer text-foreground underline underline-offset-2">
                Connect YouTrack
              </a>{" "}
              to browse the backlog.
            </p>
          )}

          {state.status === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}

          {state.status === "loaded" && state.issues.length === 0 && (
            <p className="text-sm text-muted-foreground">No open issues in this project.</p>
          )}

          {state.status === "loaded" && state.issues.length > 0 && (
            <>
              {state.truncated && (
                <p className="text-xs text-muted-foreground">
                  Showing the first {state.issues.length} open issues — there may be more.
                </p>
              )}
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title or ID…"
                aria-label="Search backlog"
                className="w-full rounded-sm border border-border bg-white/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
              {availableTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeType === null}
                    onClick={() => setActiveType(null)}
                    className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeType === null
                        ? "bg-[color:var(--accent-peach)] text-white"
                        : "bg-[color:var(--surface-glass)] text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                  {availableTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="tab"
                      aria-selected={activeType === type}
                      onClick={() => setActiveType(type)}
                      className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        activeType === type
                          ? "bg-[color:var(--accent-peach)] text-white"
                          : "bg-[color:var(--surface-glass)] text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
              {visibleIssues.length === 0 && (
                <p className="text-sm text-muted-foreground">No issues match your search in this tab.</p>
              )}
              <ul className="flex flex-col gap-2" aria-live="polite">
                {visibleIssues.map((issue) => {
                  const pulledInfo = pulledByYoutrackId.get(issue.id);
                  const isSelected = selected.has(issue.id);
                  const isExpanded = expandedIds.has(issue.id);
                  const sub = subItems[issue.id];
                  // Only leaf issues carry estimates and can be pulled -- a
                  // parent's hours are its sub-items', so pulling both would
                  // double-count.
                  const rolledUp = state.rollups[issue.id];
                  const isParent = rolledUp !== undefined;
                  const canSelect = !!activeSprintId && !pulledInfo && !isParent;
                  const missingEstimate = canSelect && !hasValidEstimate(issue.id);
                  return (
                    <li key={issue.id} className="glass-row flex flex-col gap-1.5 px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canSelect && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={pulling || missingEstimate}
                            onChange={() => toggleSelected(issue.id)}
                            aria-label={`Select ${issue.summary}`}
                            className="size-4 cursor-pointer accent-[color:var(--accent-peach)]"
                          />
                        )}
                        <div className="flex flex-1 items-center justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{issue.summary}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{issue.id}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>
                          {issue.type ? `${issue.type} · ` : ""}
                          {issue.assignee ?? "Unassigned"}
                          {issue.priority ? ` · ${issue.priority}` : ""}
                        </span>
                        {pulledInfo ? (
                          <StatusChip variant="neutral">Pulled</StatusChip>
                        ) : isParent ? (
                          <RolledUpEstimate total={rolledUp} own={issue.estimateHours} />
                        ) : issue.estimateHours !== null ? (
                          <span className="shrink-0 font-heading text-foreground">{issue.estimateHours.toFixed(1)}h</span>
                        ) : (
                          <span className="shrink-0">No estimate</span>
                        )}
                      </div>
                      {pulledInfo && (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Assignee</span>
                          <select
                            value={pulledInfo.assigneeId ?? ""}
                            disabled={assigningIds.has(issue.id) || teamMembers.length === 0}
                            onChange={(event) =>
                              handleAssigneeChange(issue.id, pulledInfo.backlogIssueId, event.target.value)
                            }
                            aria-label={`Assignee for ${issue.summary}`}
                            className="cursor-pointer rounded-sm border border-border bg-white/40 px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                          >
                            <option value="">{teamMembers.length === 0 ? "No Team Members yet" : "Unassigned"}</option>
                            {teamMembers.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {isParent && (
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleSubItems(issue.id)}
                            aria-expanded={isExpanded}
                            className="flex cursor-pointer items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ChevronRight
                              className={`size-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              aria-hidden="true"
                            />
                            Sub-items{sub?.status === "loaded" ? ` (${sub.items.length})` : ""}
                          </button>
                          {isExpanded && sub?.status === "loading" && (
                            <p aria-busy="true" className="flex items-center gap-1.5 pl-4 text-xs text-muted-foreground">
                              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                              Loading sub-items…
                            </p>
                          )}
                          {isExpanded && sub?.status === "error" && (
                            <p role="alert" className="pl-4 text-xs text-destructive">
                              {sub.message}
                            </p>
                          )}
                          {isExpanded && sub?.status === "loaded" && sub.items.length === 0 && (
                            <p className="pl-4 text-xs text-muted-foreground">No sub-items.</p>
                          )}
                          {isExpanded && sub?.status === "loaded" && sub.items.length > 0 && (
                            <ul className="ml-1.5 flex flex-col gap-1.5 border-l border-border pl-3">
                              {sub.items.map((child) => (
                                <li key={child.id} className="flex flex-col gap-0.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-medium text-foreground">{child.summary}</span>
                                    <span className="shrink-0 text-xs text-muted-foreground">{child.id}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                    <span>
                                      {[child.type, child.state, child.assignee ?? "Unassigned"].filter(Boolean).join(" · ")}
                                    </span>
                                    {pulledByYoutrackId.has(child.id) ? (
                                      <StatusChip variant="neutral">Pulled</StatusChip>
                                    ) : state.rollups[child.id] !== undefined ? (
                                      <RolledUpEstimate total={state.rollups[child.id]} own={child.estimateHours} />
                                    ) : (
                                      child.estimateHours !== null && (
                                        <span className="shrink-0 font-heading text-foreground">
                                          {child.estimateHours.toFixed(1)}h
                                        </span>
                                      )
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {assignErrors[issue.id] && (
                        <p role="alert" className="text-xs text-destructive">
                          {assignErrors[issue.id]}
                        </p>
                      )}
                      {missingEstimate && (
                        <p className="text-xs text-[color:var(--signal-warning)]">
                          Set an estimate on this issue in YouTrack to pull it.
                        </p>
                      )}
                      {pullErrors[issue.id] && (
                        <p role="alert" className="text-xs text-destructive">
                          {pullErrors[issue.id]}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {activeSprintId ? (
                <Button type="button" disabled={!canPull} onClick={handlePullSelected} className="self-start">
                  {pulling ? "Pulling…" : `Pull Selected (${selectedValid.length})`}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Create a Sprint to pull issues.</p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
