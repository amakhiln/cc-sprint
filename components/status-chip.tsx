// Status Chip (DESIGN.md `components.status-chip`) -- pill-shaped, Caption
// face. `neutral` is the mint-tinted "on track" chip; `warning` is the one
// true warning color (`signal-warning`), reserved for genuine urgency
// (Emergency Leave, over-allocation). `holiday` and `planned-leave` are a
// 2026-08-24 deliberate deviation from DESIGN.md's original "signal-warning
// covers every leave/holiday case" rule -- explicitly requested so Holiday,
// Planned Leave, and Emergency Leave read as three distinct things at a
// glance, not one undifferentiated warning color. Both reuse existing
// Aurora Light accent tokens (gold, lilac) rather than introducing new hues.
const VARIANT_STYLE: Record<StatusChipVariant, React.CSSProperties> = {
  warning: { background: "rgba(224, 87, 92, 0.14)", color: "var(--signal-warning)" },
  // Mint/gold text-on-tint fails contrast at these tint strengths (DESIGN.md
  // doesn't specify chip text color) -- ink-primary keeps each accent's
  // identity in the background while staying readable.
  neutral: { background: "rgba(63, 191, 149, 0.22)", color: "var(--foreground)" },
  holiday: { background: "rgba(242, 200, 121, 0.32)", color: "var(--foreground)" },
  "planned-leave": { background: "rgba(142, 124, 255, 0.18)", color: "var(--foreground)" },
};

export type StatusChipVariant = "neutral" | "warning" | "holiday" | "planned-leave";

export function StatusChip({
  variant,
  children,
}: {
  variant: StatusChipVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide uppercase"
      style={VARIANT_STYLE[variant]}
    >
      {children}
    </span>
  );
}
