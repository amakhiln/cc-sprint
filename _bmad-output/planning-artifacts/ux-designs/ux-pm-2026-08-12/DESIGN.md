---
name: 'Sprint & Velocity Planner'
description: 'A warm, airy glass instrument for sprint capacity — pastel gradient canvas, frosted panels throughout, numbers you can trust at a glance.'
status: final
created: '2026-08-12'
updated: '2026-08-17'
amended: '2026-08-17 (full identity rework: universal glassmorphism, new typography, "Aurora Light" direction — supersedes the 2026-08-12 scoped-glass amendment)'
sources: ['_bmad-output/planning-artifacts/prds/prd-pm-2026-08-12/prd.md', '_bmad-output/planning-artifacts/architecture/architecture-pm-2026-08-12/ARCHITECTURE-SPINE.md', '_bmad-output/specs/spec-sprint-velocity-planner/SPEC.md', '_bmad-output/planning-artifacts/epics.md']
colors:
  surface-base: '#FBF7F2'
  surface-glass: 'rgba(255,255,255,0.55)'
  surface-glass-strong: 'rgba(255,255,255,0.7)'
  border-glass: 'rgba(255,255,255,0.9)'
  ink-primary: '#34302C'
  ink-muted: '#706960'
  accent-peach: '#FF8B6B'
  accent-lilac: '#8E7CFF'
  accent-mint: '#3FBF95'
  accent-gold: '#F2C879'
  signal-warning: '#E0575C'
typography:
  display:
    fontFamily: 'Space Grotesk'
    fontWeight: 500
    letterSpacing: '0.002em'
  body:
    fontFamily: 'IBM Plex Sans'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: '1.5'
  caption:
    fontFamily: 'IBM Plex Sans'
    fontSize: '12px'
    fontWeight: 500
    letterSpacing: '0.02em'
    textTransform: 'uppercase'
rounded:
  sm: '10px'
  md: '16px'
  lg: '24px'
  xl: '28px'
  full: '9999px'
  DEFAULT: '16px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '6': '24px'
  '8': '32px'
  '12': '48px'
  gutter: '24px'
  section-gap: '48px'
components:
  canvas-mesh:
    base: '{colors.surface-base}'
    blobs: ['{colors.accent-peach}', '{colors.accent-lilac}', '{colors.accent-mint}']
    opacity: '0.4-0.65'
  glass-panel:
    background: '{colors.surface-glass}'
    blur: '28px'
    saturate: '160%'
    border: '1px solid {colors.border-glass}'
    radius: '{rounded.xl}'
  button-primary:
    background: '{colors.accent-peach}'
    text: '{colors.surface-base}'
    radius: '{rounded.sm}'
    fontFamily: '{typography.body.fontFamily}'
  category-palette:
    order: ['{colors.accent-peach}', '{colors.accent-lilac}', '{colors.accent-mint}', '{colors.accent-gold}']
  capacity-ledger:
    track: '{colors.surface-glass}'
    segments: '{components.category-palette}'
    height: '22px'
    radius: '{rounded.full}'
  status-chip:
    radius: '{rounded.full}'
    fontFamily: '{typography.caption.fontFamily}'
    fontSize: '{typography.caption.fontSize}'
  data-figure:
    fontFamily: '{typography.display.fontFamily}'
    fontWeight: '{typography.display.fontWeight}'
---

# DESIGN.md — Sprint & Velocity Planner

## Brand & Style

This is still a precision tool for turning guessed hours into trusted numbers — that thesis hasn't changed — but the register has: warm, airy, and current instead of clinical. `[NOTE]` This supersedes the 2026-08-12 "quiet precision instrument, glass only on overlays" thesis at the PM's explicit request for a full identity rework, not a treatment layered on top of it. A soft pastel gradient mesh sits behind every screen, and every surface — cards, rows, panels, dialogs, not just floating overlays — is frosted glass over it. The gradient gives the glass something to filter; without it, universal glass on a flat background would just look washed-out. `[ASSUMPTION]` Landing on "boutique, calm SaaS instrument" rather than "moody/dark" or "high-contrast editorial" — the other three directions explored (dark mission-control, high-contrast poster) were rejected in favor of this warmer, lighter register.

## Colors

- `{colors.surface-base}` (`#FBF7F2`) — the base canvas underneath the gradient mesh. Warm off-white, never pure white — the glass needs a canvas with some warmth to filter.
- `{colors.surface-glass}` / `{colors.surface-glass-strong}` (`rgba(255,255,255,0.55)` / `0.7`) — the universal panel fill. Every card, row, and dialog uses one of these two, never a flat opaque color.
- `{colors.border-glass}` (`rgba(255,255,255,0.9)`) — the faint light edge that gives a glass panel definition against the mesh behind it.
- `{colors.ink-primary}` (`#34302C`) — primary text, a warm near-black.
- `{colors.ink-muted}` (`#706960`) — secondary text, captions, helper copy. `[NOTE]` Darkened from the original `#8A8177` (2026-08-24) after the shipped value measured ~3.4:1 against glass panels, under WCAG AA's 4.5:1 minimum for body text; `#706960` keeps the same warm-taupe hue at ~5:1.
- `{colors.accent-peach}` (`#FF8B6B`) — primary actions, the first category color, and anything meaning "positive/actionable."
- `{colors.accent-lilac}` (`#8E7CFF`) — second category color; also used in decorative gradient marks (e.g. the brand mark, avatars).
- `{colors.accent-mint}` (`#3FBF95`) — third category color; also the "on track" status-chip tint.
- `{colors.accent-gold}` (`#F2C879`) — fourth category color, used when a fourth Allocation Category exists.
- `{colors.signal-warning}` (`#E0575C`) — the one warning color: over-allocation, hours lost to Leave/Holiday, and any blocking/error state. Kept singular so a warning is always unambiguous.

**Do** let the gradient mesh show through every glass panel — that's what reads as "glass," not just a translucent color. **Don't** add a fifth category hue past gold; a 5th+ category cycles back through the four rather than growing the palette indefinitely.

## Typography

- **Display** (`{typography.display}`, Space Grotesk) — headings, the Capacity headline number, screen titles. Geometric with a slightly technical edge; carries a "modern SaaS-native" feel.
- **Body** (`{typography.body}`, IBM Plex Sans) — labels, form fields, table content, prose. Crisp and neutral, pairs cleanly with Space Grotesk without competing.
- **Caption** (`{typography.caption}`, IBM Plex Sans, small/medium-weight/uppercase) — status chip labels, section eyebrows, table column headers.

`[NOTE]` This direction drops the prior "Data face" (monospace tabular figures) typographic signature — the approved Aurora Light mockup sets every number, including Capacity and Allocation %, in the Display face rather than a dedicated mono face. Numbers stay visually prominent via size and the Display face's weight, not via a separate typeface.

`[NOTE]` Space Grotesk + IBM Plex Sans ("Modern Technical") replaced the original General Sans + Satoshi pairing on 2026-08-24, after a live side-by-side comparison against three other candidate pairings. Same two-role system (display/body), just a different pair of Google-Fonts-hosted faces in place of the original Fontshare-hosted ones.

**Don't** introduce a third font family — every direction explored kept to exactly two.

## Layout & Spacing

Spacing scale (`{spacing}`) follows a 4px base rhythm (`{spacing.1}`–`{spacing.12}`), with `{spacing.gutter}` (24px) for page margins and inter-panel gaps and `{spacing.section-gap}` (48px) between major vertical sections. Glass panels use generous internal padding (`{spacing.6}`–`{spacing.8}`) — cramped content inside a frosted panel reads as a mistake, not a style.

## Elevation & Depth

One depth language now, not two: everything that isn't the page canvas itself is a glass panel (`{components.glass-panel}`) — the top bar, cards, roster rows, list items, dialogs, all of it. `[ASSUMPTION]` This is a deliberate reversal of the 2026-08-12 decision that scoped glass to only floating overlays; the PM's explicit ask this time was glassmorphism throughout. The distinction that still matters is depth of blur and opacity, not glass-vs-no-glass: resting content (roster rows, list items) uses a lighter, more transparent glass (`{colors.surface-glass}` at the lower end); a dialog or side panel that genuinely floats above the page uses the stronger variant (`{colors.surface-glass-strong}`) with a more pronounced shadow. Where the OS or browser signals `prefers-reduced-transparency`, every glass panel falls back to an opaque `{colors.surface-base}` with a soft shadow — the layering cue survives even when the blur can't render.

## Shapes

`{rounded.sm}` (10px) for inputs and small buttons, `{rounded.md}` (16px, the default) for list items and rows, `{rounded.lg}`–`{rounded.xl}` (24–28px) for cards, panels, and dialogs — glass reads best with generous, soft rounding rather than sharp corners. `{rounded.full}` (pill) for status chips, the top bar's sprint-context pill, and the Capacity Ledger bar.

## Components

- **Canvas Mesh** (`{components.canvas-mesh}`) — the page background, present on every screen: soft radial-gradient blobs in the three primary accent hues at low opacity over `{colors.surface-base}`. This is not decoration; it's the layer every glass panel filters, and without it the glass treatment has nothing to show through.
- **Glass Panel** (`{components.glass-panel}`) — the universal container: `{colors.surface-glass}` fill, 28px backdrop blur at 160% saturation, a `{colors.border-glass}` hairline, `{rounded.xl}` corners, a soft warm-tinted shadow. Used for the top bar, every card, roster rows, list items, and dialogs — see Elevation & Depth for the resting-vs-floating opacity distinction.
- **Capacity Ledger** (`{components.capacity-ledger}`) — the product's signature element, now a multi-segment pill bar: one segment per Allocation Category, colored from `{components.category-palette}` in order, over a `{colors.surface-glass}` track. The headline number above it is set in the Display face at a large size. Appears at the top of the Sprint Plan Overview (team-wide) and, smaller, per row in the roster.
- **Category Palette** (`{components.category-palette}`) — the four accent hues (peach, lilac, mint, gold) assigned to Allocation Categories in creation order, cycling if a fifth is added. Replaces the prior single-accent-only rule; categories now need to be visually distinguishable from each other, not just from the page.
- **Status Chip** (`{components.status-chip}`) — pill-shaped, Caption face. Four variants, each a distinct low-opacity tint so leave/holiday states read apart at a glance: `neutral` tints `{colors.accent-mint}` (e.g. "on track"); `holiday` tints `{colors.accent-gold}` (Holiday); `planned-leave` tints `{colors.accent-lilac}` (Planned Leave); `warning` tints `{colors.signal-warning}` (over-allocation, Emergency Leave — reserved for genuine urgency). 2026-08-24 revision: Holiday and Planned Leave were split out of `warning` so all leave/holiday types are visually distinguishable, not just leave-vs-not.
- **Button, primary** (`{components.button-primary}`) — solid `{colors.accent-peach}` fill, `{colors.surface-base}` text, `{rounded.sm}`. Secondary actions are glass/outline style, never a second filled color.
- **Data Figure** (`{components.data-figure}`) — every standalone number (a Capacity total, a Velocity History value): Display face, right-aligned in tables.

The four key-screen mockups (`mockups/key-sprint-plan-overview.html`, `mockups/key-team-member-detail.html`, `mockups/key-backlog-drawer.html`, `mockups/key-team-view.html`) predate this rework and still show the prior scoped-glass thesis; `mockups/key-sprint-plan-overview.html` has been replaced with the new Aurora Light direction, the other three are stale and should be regenerated to this system before their epics (2–4) are built. This spine's token values win on any conflict with any mock.

## Do's and Don'ts

- **Do** apply the glass panel treatment everywhere — every card, row, and dialog, not just floating overlays. This is the headline change from the prior thesis.
- **Do** let the Canvas Mesh show through every glass panel; a glass treatment over a flat background reads as a mistake, not a style.
- **Do** show `cursor: pointer` on every interactive element (buttons, links, clickable rows) — see EXPERIENCE.md's Interaction Primitives.
- **Don't** introduce a fifth category hue — cycle back through the four.
- **Don't** use `{colors.signal-warning}` for anything but a genuine warning/error state (over-allocation, Emergency Leave) — Holiday and Planned Leave get their own gold/lilac Status Chip tints instead (2026-08-24 deviation, see `{components.status-chip}`).
- **Don't** drop the `prefers-reduced-transparency` opaque fallback when adding new glass panels.
