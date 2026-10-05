# Verification-Gap Review — Sprint & Velocity Planner PRD

Reviewed: `prd.md` + `addendum.md` (prd-pm-2026-08-12)
Focus: claims that sound settled but are unverified, internally inconsistent, or rest on an unstated dependency.

---

## CRITICAL

### C-1: "No native sprint/agile-board object" is asserted from a docs summary, not the live MCP tool list, and carries no re-verification caveat
**Location:** `addendum.md` line 11, echoed in `prd.md` FR-17 Out-of-Scope bullet ("No native 'sprint' or agile-board object exists on the YouTrack MCP surface").

**Gap:** The addendum states this as fact — "confirmed by docs summary" — meaning someone read the JetBrains help page, not the actual tool list returned by a running MCP server. Docs summaries can omit tools, lag behind server versions, or describe capabilities that differ by YouTrack edition/version. The addendum *does* flag a re-confirmation need for the adjacent write-capability point (line 13: "worth re-confirming... before architecture locks in") but pointedly does **not** apply that same caveat to the sprint/agile-board absence claim, even though it's the more architecturally load-bearing one.

**Why it matters:** This single claim is the foundation for FR-17's Out-of-Scope bullet, the entire "this app owns Sprint/board concepts entirely, never synced back to YouTrack" architectural stance (§4.4), and the manual re-pull design (no auto carry-over). If the live MCP tool list actually exposes a sprint/board-adjacent tool (even partially — e.g., a "board" or "sprint" search filter), the integration model and possibly the schema ownership boundary would need to change after architecture has already committed to owning it entirely in-app.

**Suggested fix:** Before architecture locks the integration boundary, have someone actually connect to a live YouTrack MCP server instance and enumerate its tool list (not just read the docs page), and record that verification (tool names + date) in the addendum. Until then, tag this claim `[UNVERIFIED — docs only]` rather than presenting it as confirmed.

---

## HIGH

### H-1: The "configurable custom field" for Estimate assumes one field name works across all YouTrack Projects
**Location:** `prd.md` FR-18 Consequences ("`[ASSUMPTION]` Estimate hours are read from a configurable YouTrack custom field (e.g. 'Estimation') at pull time"); also implicated in FR-14 (Actual Velocity pull, see H-2).

**Gap:** FR-17 lets the PM "select a YouTrack Project" (singular, implying a choice among multiple projects in the instance). FR-18's fallback assumes a single, instance-wide configured field name. YouTrack allows each project to have its own field scheme — it's common for different projects to name or even omit an "Estimation"-equivalent field differently. A single global config setting doesn't address the case where Project A calls it "Estimation" and Project B calls it "Story Points" or doesn't have it at all. The FR's fallback (manual entry when the field is "absent") only covers total absence, not a differently-named field silently being ignored per project.

**Why it matters:** If the PM regularly works across more than one YouTrack Project, this "fallback" is not airtight — it will silently degrade to manual entry for every issue in any project that doesn't match the one configured field name, without the PM necessarily realizing why the estimate isn't populating. This could be read at architecture time as "single config field, done" when it actually needs a per-project mapping table.

**Suggested fix:** Clarify whether the app supports multiple YouTrack Projects concurrently, and if so, make the field-name configuration per-project (or explicitly scope v1 to a single Project only, which would also simplify several other FRs).

### H-2: FR-14's "Actual Velocity" conflates two different, non-interchangeable data sources with an unstated dependency on YouTrack time-logging discipline
**Location:** `prd.md` FR-14 ("System pulls Actual Velocity automatically from completed Backlog Issues' estimate/logged-hours fields via the YouTrack MCP Integration").

**Gap:** "Estimate" and "logged-hours" are fundamentally different numbers — one is the pre-work planned-hours figure (the same field FR-18 pulls for Planned Velocity), the other is actual time-tracking work-log data reflecting effort spent. The FR presents them as if either is an acceptable source ("estimate/logged-hours fields") without specifying which one is authoritative, or how they're reconciled if both exist and disagree. This matters doubly because:
- If Actual Velocity = completed issues' *estimate* hours, it isn't actually measuring "what really happened," just "which issues got marked done" — a much weaker signal than the name implies.
- If Actual Velocity = *logged* hours, it depends on team members (who, per §2.2, don't use this app and have no obligation defined anywhere to log time in YouTrack) actually maintaining disciplined time-tracking work-log entries. Nothing in the PRD establishes this as an existing team practice or a new requirement. If nobody logs time in YouTrack, this data source is reliably empty, and "automatically" pulled Actual Velocity silently becomes 0 or absent for every issue, every sprint.

**Why it matters:** SM-2 ("Actual Velocity within a reasonable range of Planned Velocity") is one of only two primary success metrics, and it's built entirely on top of this ambiguous, possibly-empty data source. If architecture picks "logged-hours" per the FR's literal wording and the team doesn't log time in YouTrack, the feature ships non-functional and SM-2 becomes unmeasurable from day one — a much bigger downstream cost than fixing the wording now.

**Suggested fix:** Pick one source explicitly (recommend: completed issues' estimate hours, for symmetry with Planned Velocity, since that's what Capacity math is built around) and drop "logged-hours" from FR-14, or add an explicit precondition that the team maintains YouTrack work-log entries and flag that as a new operational dependency, not just an "automatic pull."

### H-3: FR-9's additive leave+holiday formula double-counts overlapping days and doesn't specify whether weekend days are excluded from "leave days"/"holiday days" counts
**Location:** `prd.md` FR-9 and its worked example; FR-8 (Holiday consequence); Glossary "Capacity."

**Gap:** The formula is `(leave days + holiday days) × Working Hours × Dev Allocation %`. Two edge cases the formula doesn't address, both realistic and likely to occur:
1. **Overlap double-count:** If a company Holiday (FR-8, applies to everyone) falls within a Team Member's already-recorded Leave date range (FR-6/FR-7) — e.g., a person takes a week of Planned Leave that includes a public holiday inside it — the additive formula counts that single calendar day twice (once as a leave day, once as a holiday day), overstating the hours lost for that person on that day.
2. **Weekend inclusion:** Neither FR-6/FR-7 (leave entry as "a date range") nor FR-9 specifies whether a leave date range's day-count is restricted to working days before being multiplied by Working Hours. Since Capacity itself is only computed "over the Sprint's working days" (Glossary), a leave/holiday day count that naively includes weekend days within the entered range would subtract hours for days that were never part of Capacity to begin with — either silently under- or over-stating the reduction depending on how "leave days" is actually counted at implementation time.

**Why it matters:** This is the core "make the math explicit" value proposition of the entire tool (§1 Vision). A formula that can overstate hours lost — especially around common holiday-adjacent leave patterns (e.g., a week off that includes a public holiday) — produces a wrong Capacity number in exactly the scenario the PM is most likely to hit, undermining trust in the tool's central promise.

**Suggested fix:** Specify that "leave days"/"holiday days" in FR-9 means distinct working days actually lost (dedupe overlapping Leave+Holiday on the same calendar day; count only Sprint working days, excluding weekends already outside the working-day set), and add a worked example that includes an overlapping Holiday-during-Leave case to lock in the intended behavior before architecture builds the calculation.

---

## MEDIUM

### M-1: FR-13's "Capacity breakdown by Allocation Category" is inconsistent with the Glossary's Dev-only definition of Capacity
**Location:** `prd.md` FR-13 ("Capacity broken down by Team Member and by Allocation Category (e.g. how many hours are absorbed by Management vs. Dev vs. DevOps...)"); contrast with Glossary "Capacity" ("the *Dev-allocated* hours...") and FR-11 (formula uses only Dev Allocation %).

**Gap:** Every other place "Capacity" is defined or computed (Glossary, FR-9, FR-11, FR-12) ties it specifically to the Dev Allocation Category. FR-13 then asks for a "Capacity breakdown" across Management/DevOps/etc. — categories that, by definition, aren't part of Capacity at all. There's no formula anywhere for how Leave/Holiday affects the Management/DevOps hour totals shown in this breakdown (FR-9 only reduces the Dev-allocated figure). It's unclear if FR-13 is repurposing the term "Capacity" loosely to mean "any allocated hours" (a Glossary violation) or if it's actually a distinct, undefined calculation.

**Why it matters:** An architect implementing FR-13 literally has no defined formula for non-Dev category numbers, and no guidance on whether Leave reduces them. Numbers could be built inconsistently with the rest of the spec, or the screen could silently show static (non-Leave-adjusted) numbers for Management/DevOps sitting next to Leave-adjusted Dev numbers, which would look like a bug to the PM.

**Suggested fix:** Either rename the FR-13 view to something other than "Capacity breakdown" (e.g., "Allocated Hours breakdown") and define how Leave/Holiday affects non-Dev categories, or explicitly state that Leave/Holiday reduction applies uniformly across all categories (not just Dev), and update the Glossary's Capacity definition accordingly.

### M-2: Addendum cites the wrong FR number for the read-only YouTrack scoping decision
**Location:** `addendum.md` line 13: "Write capability exists (create/update issues, log time) but PRD FR-15 explicitly scopes v1 to read-only use..."

**Gap:** FR-15 in `prd.md` is "Velocity History and trend" — unrelated to YouTrack write scope. The actual read-only scoping requirement is the Out-of-Scope bullet under FR-17 ("Read-only in v1 — the app does not create, update, comment on, or otherwise write back to YouTrack issues..."), which the PRD's own §9 Assumptions Index correctly attributes to FR-17. The addendum's cross-reference is simply wrong.

**Why it matters:** Low damage on its own, but this is exactly the kind of small cross-document citation error that compounds during architecture handoff — someone re-confirming "should we keep the client read-only" per the addendum's own suggestion ("worth re-confirming with PM before architecture locks in a read-only client") could look up FR-15, find it's about Velocity History, and either get confused or skip the re-confirmation entirely.

**Suggested fix:** Correct the addendum's citation from FR-15 to FR-17.

### M-3: FR-24's "trusted network" assumption is asserted but not enforced by any requirement, and doesn't address out-of-band link leakage
**Location:** `prd.md` FR-24 Consequences (`[ASSUMPTION]`), §9 Assumptions Index; `addendum.md` "Read-only Team View — privacy/network consideration."

**Gap:** The no-auth decision rests entirely on an assumption ("the app is only exposed on a network the team already trusts") with no corresponding FR/NFR requiring that the deployment actually enforce network-level restriction (VPN gating, IP allowlist, firewall rule, etc.) — it's a documentation-only safeguard, not a built one. Separately, even a genuinely trusted network doesn't prevent the shared link itself from leaking outside that network via ordinary use (forwarded email, pasted into a public/external Slack channel, a phone screenshot) — since FR-24 requires no token or anything unguessable, anyone possessing the link, from anywhere, sees leave dates, assignee names, and capacity data with zero access control. The addendum names the unguessable-link-token mitigation but only recommends it as future work if the deployment target changes, not as defense-in-depth for the v1 trusted-network case.

**Why it matters:** This is the PRD's most consequential v1 exposure risk (personal leave data, no auth, one link), and currently nothing about it is verifiable or enforced — it's fully dependent on deployment discipline the PRD has no mechanism to guarantee. If the app is later deployed with a public URL (e.g., default cloud hosting without a VPN in front of it) or the link is shared outside the intended circle, there is zero fallback protection.

**Suggested fix:** Either add an NFR requiring network-level access restriction as a deployment gate (not just a PRD assumption), or add the unguessable-link-token as a cheap v1 baseline (defense-in-depth) regardless of the trusted-network assumption, per the addendum's own suggestion.

---

## LOW

### L-1: SM-1 measures tool usage, not the adoption claim it's framed as
**Location:** `prd.md` §7 SM-1 ("Every new Sprint is created and planned in-app (not a spreadsheet)").

**Gap:** The only thing the app can actually observe is "a Sprint record exists in-app." It has no way to detect whether the PM is *also* maintaining a spreadsheet in parallel (the thing the metric is actually trying to rule out). Since creating an in-app Sprint is the only way to use the tool at all, this metric is close to trivially satisfied by definition and doesn't verify the behavioral claim in its own name.

**Why it matters:** Low architectural risk (nothing needs to be built differently), but as written the metric can't fail in a way that would ever flag a real adoption problem, which undercuts its usefulness as a "primary" success metric.

**Suggested fix:** Reframe as a simple usage count ("N sprints created in-app since launch") without the "not a spreadsheet" adoption claim, or accept it's an anecdotal/qualitative check (ask the PM) rather than an in-app-measurable one.

### L-2: No FR exists for editing a Team Member's Working Hours after creation
**Location:** `prd.md` FR-1 (sets "default daily Working Hours" at add-time) vs. FR-5 (explicit edit path exists for Allocation %, not for Working Hours).

**Gap:** Working Hours feeds directly into the Capacity formula (FR-11) the same way Allocation % does, but only Allocation % has an explicit "can be changed later" FR (FR-5). It's likely just an omission rather than an intentional restriction, but as written a literal reading leaves Working Hours immutable after add.

**Why it matters:** Minor — almost certainly resolved trivially in implementation (add an edit form), but worth a one-line clarification since Capacity is a headline calculation and this input is currently a gap in the FR list.

**Suggested fix:** Add a short "PM can edit a Team Member's Working Hours" consequence, mirroring FR-5's "current/future sprints only" retroactivity rule.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 3 |
| Medium | 3 |
| Low | 2 |

Sections that held up under scrutiny and are **not** flagged: FR-9's worked-example arithmetic itself (3 × 8 × 0.6 = 14.4 is correct); FR-2/FR-5's non-retroactivity rules (internally consistent with each other); the core Capacity formula chain Glossary → FR-9 → FR-11 → FR-12 (internally consistent, aside from the FR-13 category-breakdown mismatch noted in M-1); SM-2 and the Open Questions section (the PRD already transparently flags SM-2's threshold as deliberately unset, which is the right call, not a gap).
