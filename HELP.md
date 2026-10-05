# Sprint & Velocity Planner — Help Guide

This is a single-team Sprint capacity planning tool. There's no login: it runs on your own machine, and anyone with a link to it on your network can open it. Everything below describes the workflow in the order you'd actually use it.

## Quick reference

| Page | What it's for |
|---|---|
| **Sprint Plan** (home page) | Your day-to-day view: current Sprint's Capacity, Roster, and assigned issues. Also where you close a Sprint. |
| **Roster** | Add/remove team members, set their working hours, configure Allocation Categories, and set each person's allocation % per category. |
| **Backlog** | Connect to your Sprint (once it exists) and pull YouTrack issues into it. |
| **Leave & Holidays** | Record company-wide holidays. (Per-person leave is recorded on the Roster page — see below.) |
| **Velocity History** | Planned vs. Actual hours for every closed Sprint, most recent first. |
| **Settings** | Connect YouTrack (optional). |

---

## 1. First-time setup

Do this once, before your first Sprint:

1. **Go to Roster.** Add each team member (name + working hours per day).
2. **Add at least one Allocation Category** (e.g. "Dev", "Support", "Management") and mark exactly one of them as **Dev**. Capacity is only computed against the category marked Dev — this is the category whose hours count as available Sprint capacity.
3. **Set each person's allocation %** by clicking their name on the Roster list. Their Dev % determines how much of their time counts toward Sprint Capacity.
4. *(Optional)* **Connect YouTrack** on the Settings page if you want to pull real issues instead of tracking everything by hand. You'll need your YouTrack instance URL, the project's short name (not its display name), and an auth token. If you skip this, you can still create Sprints and track Leave/Holidays — you just won't be able to pull YouTrack issues.

## 2. Recording Leave and Holidays

- **Per-person leave** (planned or emergency): click a team member's name on the Roster page — the leave entry form is inside their detail panel.
- **Company-wide holidays**: go to **Leave & Holidays** and add a date range. A holiday reduces everyone's Capacity for that Sprint.

Both reduce the affected person's (or everyone's) Capacity automatically — you don't need to do anything else.

## 3. Starting a Sprint

Only one Sprint can be active at a time. Go to the **Sprint Plan** (home) page — if there's no active Sprint, you'll see a form there to create one (start date + length in days). Once created, the home page becomes your live Capacity/Roster/assigned-issues view for that Sprint.

## 4. Pulling and assigning issues

1. Go to **Backlog** and click **Browse Backlog** — this only works if YouTrack is connected (Settings).
2. Pull the issues you want into the current Sprint, entering an estimate in hours for each (YouTrack's own estimate is used as a starting point when available).
3. Assign each pulled issue to a team member using the dropdown next to it. An issue can be reassigned or unassigned at any time while the Sprint is active.

Assigned issues then show up on the **Sprint Plan** page under "Assigned Backlog Issues."

## 5. Reading the Capacity Ledger

Every Capacity number you see (team-wide, on the Sprint Plan page, and per-person, on both Sprint Plan and Roster) works the same way:

- The big number is that person's or the team's available Dev-hours for the Sprint, after leave/holidays are deducted.
- Click the **Breakdown** disclosure under any Capacity number to see the same hours split out by every Allocation Category, not just Dev.
- If you see an **"Over-allocated"** chip next to an "Assigned: Xh" line, it means more hours are assigned than there's Capacity for. **This is advisory only** — it never blocks you from assigning more issues, pulling more work, or closing the Sprint. It's just a heads-up.

## 6. Closing a Sprint

When the Sprint is over, click **Close Sprint** on the Sprint Plan page. This opens a review screen:

- Each assigned issue shows its logged hours pulled from YouTrack, if available and if YouTrack is connected — editable, so you can correct it before confirming.
- An issue that shows **"Not yet checked"** (in muted italics) means nothing could be pulled for it — fill in the real hours yourself. This is different from an issue showing **"0h logged"**, which means it really was checked and genuinely has zero logged time.
- Adjust any figure, then click **Confirm and close**.

Once confirmed:
- The Sprint becomes permanently read-only — its Capacity and Actual Velocity are locked in and never recomputed later, even if you change Roster/allocation data afterward.
- Any issue still assigned but not finished stays as-is in YouTrack — nothing carries over automatically. Pull it again into the next Sprint yourself if it's still relevant.
- The single-active-Sprint slot is freed, so you can create the next Sprint.

## 7. Velocity History

Go to **Velocity History** to see every closed Sprint's Planned Velocity (hours committed to assigned issues at the start), confirmed Actual Velocity, and the delta between them — most recent Sprint first. This is the only place that shows the trend across Sprints; it's read-only.

## 8. Sharing with your team

Every Sprint Plan page has a **"Team View link"**. This is one standing link — the same one always, not a new one per Sprint — that shows your whole team the current Sprint's Capacity, Roster, Leave/Holidays, and assigned issues, with no login and nothing editable. Send it to your team once; it always reflects whatever's currently active, and updates the moment anyone with the link reloads it (there's no separate notification — just reload to see the latest).

Do **not** treat this link as a security boundary — anyone who has it can view the current Sprint. It isn't guessable, but it also isn't password-protected. Don't post it somewhere public.

---

## Frequently asked

**Why does Capacity say "Mark a category as Dev to see Capacity"?**
No Allocation Category has been marked Dev yet. Go to Roster and click "Mark as Dev" next to the category that represents actual development work.

**Why can't I pull YouTrack issues?**
YouTrack isn't connected. Go to Settings and save a connection (Instance URL, Project ID, Auth Token). If saving fails, the error will tell you what's wrong with the connection itself.

**I assigned too many hours to someone — why won't it stop me?**
It's meant to warn, not block. Over-allocation is common and often intentional (e.g. temporary crunch); the tool flags it so you're aware, but the decision is yours.

**Can I undo closing a Sprint?**
No — closing is permanent by design, so Velocity History stays trustworthy. Double-check the figures in the review screen before confirming.

**Someone left the team — what happens to their old assignments?**
Removing a team member is a soft delete: their historical Leave, allocations, and past assignments stay intact for already-closed Sprints. If they still hold an assigned issue in an *active* Sprint, reassign it before or after removing them, since the tool won't do this automatically.
