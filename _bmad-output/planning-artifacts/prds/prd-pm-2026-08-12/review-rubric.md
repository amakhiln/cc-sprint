# PRD Quality Review — Sprint & Velocity Planner

## Overall verdict
This is a well-built internal-tool PRD: it has a real thesis (capacity math should be explicit, not eyeballed), features that trace cleanly back to it, honest scope cuts, and a Glossary/FR/UJ structure that downstream architecture and story work can source-extract from without guessing. The risk is concentrated in done-ness: a small cluster of FRs (FR-4, FR-19, FR-10, FR-16) leave validation and error-handling behavior undecided at exactly the seams — block vs. warn, connection failure — where an implementer needs a definite answer, not a judgment call. None of this requires re-scoping the PRD; it's a handful of sentences to add before this is handed to architecture.

## Decision-readiness — strong
The PRD states real decisions rather than hedging them. FR-14's auto-pull-then-PM-confirms design for Actual Velocity is a stated trade-off (automation with a manual override, not silent trust in YouTrack data), and §4.4's "Out of Scope" bullets under FR-17 explain *why* things are excluded (no native sprint object on the MCP surface, no auto carry-over) rather than just asserting the exclusion. The `[NOTE FOR PM]` at §7 SM-2 and §8 is a genuinely open item — the Actual-vs-Planned Velocity threshold is deferred pending real data, not a rhetorical question answered in the next clause. The FR-24 no-auth assumption is flagged inline and the addendum (line 15-16) escalates it into a real "revisit if network trust assumption changes" tension. No findings — this dimension does its job.

## Substance over theater — strong
No persona bloat (two roles: PM and team-member viewer), no differentiation/innovation section manufactured for its own sake, and no NFR boilerplate ("must be scalable/secure") anywhere in the document. The Vision (§1) is specific to this product's mechanics (allocation-category percentages, leave subtraction, a "real capacity number") rather than a swappable generic statement. No findings.

## Strategic coherence — strong
The thesis ("capacity is guessed, not calculated") is carried through consistently: Team Roster & Allocation (§4.1) and Leave & Holidays (§4.2) build the capacity inputs, §4.3 turns them into a number, §4.4 sources real work against that number instead of a spreadsheet copy, and §4.3's Velocity History closes the loop on whether the estimates were any good. Success Metrics match the thesis rather than measuring activity for its own sake: SM-1 measures adoption (a fair MVP-scope metric), SM-2 measures estimate accuracy (the actual thesis), and SM-C1 is a genuine counter-metric guarding against gaming SM-2 by shrinking the planning buffer. No findings.

## Done-ness clarity — adequate
Several FRs are excellent — FR-9's worked numeric example ("3 × 8 × 0.6 = 14.4 hours") is the standard the rest of the document should be held to. But a cluster of FRs leave the actual build-time behavior undetermined:

### Findings
- **high** Save-blocking behavior undecided (FR-4) — "Saving is blocked (or clearly warned) if a Team Member's Allocation %s do not sum to 100%." Block and warn are different UIs and different data-integrity guarantees (can a Team Member persist with allocations that don't sum to 100%, or not?); an engineer cannot build this as written. *Fix:* pick one behavior explicitly, or note it as an `[ASSUMPTION]`/Open Question if genuinely undecided.
- **medium** Over-allocation warning has no defined severity (FR-19) — "System flags when a Team Member's or the team's planned issue hours exceed their computed Capacity" states that a flag exists but not whether it blocks assignment, requires confirmation, or is purely advisory. UJ-1's edge case ("the UI flags it before he finalizes, so over-commitment is a visible choice, not a surprise") implies non-blocking, but FR-19 itself doesn't say so, and this is the same block-vs-warn ambiguity as FR-4. *Fix:* state explicitly that over-allocation is advisory (non-blocking), consistent with UJ-1, and cross-reference that resolution back into FR-4 if the same policy applies there.
- **medium** No error/failure path for YouTrack connection (FR-16) — "PM can configure a connection to a YouTrack instance's MCP server (instance URL and auth token)" has no consequence describing what happens on a bad URL, invalid/expired token, or unreachable server. This is a trust-boundary FR (external system, credentials) and the PRD is otherwise careful about consequences elsewhere; this is a real gap, not a stylistic one. *Fix:* add a testable consequence, e.g. "an invalid connection surfaces an inline error and does not save the configuration."
- **medium** "Current Sprint" singularity is never stated as an invariant — FR-20, FR-22, FR-24, and the Glossary's "Sprint" definition all speak of "the current Sprint" or "a Sprint" without ever stating whether more than one Sprint can be active/planned in parallel (e.g., can the PM start planning next sprint while the current one is still open?). This is exactly the kind of implicit assumption that becomes a real data-model question in architecture. *Fix:* add a one-line invariant (e.g., "exactly one Sprint is active at a time") to §3 or §4.5, or tag it `[ASSUMPTION]` if inferred.
- **low** No testable consequence for FR-10 — "PM can see all Leave entries (Planned and Emergency, type distinguished) for a Team Member, and all Holidays, within a given Sprint" has no `Consequences (testable)` block, unlike its sibling FRs in §4.2. Likely low-risk since it's a read-only view, but the pattern-break is worth closing for consistency with FR-6/7/8/9 in the same section. *Fix:* add a one-line consequence (e.g., "entries are visible with type and date range, distinguishing Planned from Emergency").

## Scope honesty — strong
§5 Non-Goals does real work — each bullet states a specific exclusion with its own rationale ("Not a system of record for HR/payroll leave balances — Leave here exists only to adjust sprint Capacity math") rather than a boilerplate disclaimer list. All three inline `[ASSUMPTION]` tags (FR-17's read-only note, FR-18's estimate-field fallback, FR-24's no-auth/trusted-network assumption) round-trip cleanly into the §9 Assumptions Index — no orphaned or missing entries. §6.2's de-scoped items name their own deferral logic ("revisit if a second team asks," "deferred to v2") instead of silently vanishing. Open-item density (1 Open Question, 3 assumptions, 2 NOTE-FOR-PM callouts) is proportionate to an internal, moderate-stakes tool. No findings.

## Downstream usability — strong
The Glossary (§3) is genuinely load-bearing — terms like Capacity, Allocation %, Planned/Actual Velocity are defined once and then used identically across FRs, UJs, and Success Metrics (spot-checked FR-9/11/12 against the Capacity definition, FR-14/15 and SM-1/2/C1 against the Velocity definitions — all consistent). FR IDs (FR-1–FR-24) and UJ IDs (UJ-1–UJ-3) are contiguous with no gaps or duplicates, and cross-references (e.g., FR-7 → FR-24, FR-18 → FR-14, FR-23 → FR-15) all resolve to real, correctly-numbered targets.

### Findings
- **low** UJ-3 has no named protagonist — "A developer wants to see what's assigned to them" (§2.3, UJ-3) is generic where UJ-1 and UJ-2 both use "Akhil" by name. Minor since the PM is the only decision-making persona and this UJ mainly exists to motivate FR-24, but it's a floating UJ by the rubric's own test. *Fix:* name the developer (even a placeholder like "Priya, a developer on the team") for consistency.

## Shape fit — strong
This PRD correctly reads as a capability spec for a single-operator internal tool rather than a forced consumer-product template: three UJs, tightly scoped to the PM's actual workflow plus the one passive viewer interaction, is proportionate rather than UJ-density theater. Success Metrics are operational (adoption, estimate accuracy) rather than manufactured user-facing metrics. The PRD correctly omits compliance, SLA, and rollout-plan sections that would be inappropriate at this tool's stakes. No findings.

## Mechanical notes
- **Broken cross-reference in addendum.md** — addendum.md line 13 states "PRD FR-15 explicitly scopes v1 to read-only use," but the read-only scoping assumption actually lives at FR-17's Out-of-Scope bullet (prd.md §4.4), not FR-15 (which is Velocity History). This will misdirect anyone using the addendum to jump back into the PRD. *Fix:* correct the addendum's FR reference to FR-17.
- **Glossary casing drift (cosmetic)** — §2.1 JTBD bullets use lowercase "team member" in prose ("As a team member, I need to see...") against the Glossary's capitalized "Team Member." This is normal prose style, not a substantive drift — every FR and Non-Goal that matters uses the capitalized, Glossary-anchored form consistently.
- Assumptions Index (§9) roundtrip is clean: all 3 inline `[ASSUMPTION]` tags (FR-17, FR-18, FR-24) are indexed, and no index entry lacks an inline source.
- FR/UJ/SM ID continuity is clean throughout (FR-1–24, UJ-1–3, SM-1/2/C1) — no gaps, no duplicates.

## Findings by severity
- Critical: 0
- High: 1 (FR-4 block-vs-warn ambiguity)
- Medium: 3 (FR-19 warning severity, FR-16 error path, single-active-Sprint invariant)
- Low: 4 (FR-10 missing consequence, UJ-3 unnamed protagonist, addendum FR-15/FR-17 cross-ref, Glossary casing)
