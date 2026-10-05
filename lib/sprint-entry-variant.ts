import type { StatusChipVariant } from "@/components/status-chip";

// Maps a SprintScopedEntry's label (domain/calendar.ts) to its StatusChip
// color. The label vocabulary is small and fully controlled by this app
// (LEAVE_TYPE_LABEL's two values, plus the literal "Holiday" string used
// everywhere a Holiday is turned into an entry) -- matching on it directly
// is simpler than threading a separate discriminant through every call
// site. Emergency Leave (and anything unrecognized) falls back to the one
// true warning color, matching its real urgency.
export function sprintEntryVariant(label: string): StatusChipVariant {
  if (label === "Holiday") return "holiday";
  if (label === "Planned Leave") return "planned-leave";
  return "warning";
}
