# Weekly Review

Part of the Calm-X docs; start at [`docs/HANDOVER.md`](../HANDOVER.md). Describes what is built, for coding sessions.

## Weekly Review: Waiting for and Someday steps (built 2026-10-30, chosen by me; the review stays one continuous session)

Order is now Inbox, Meetings, **Waiting for**, Projects, Areas, Resources, **Someday**, Summary.

- **Waiting for** (`components/review/WaitingStep.tsx`, `GET /api/weekly-review/waiting?today=&tz_offset=`): every open waiting-for task
  (not Someday, not in an archived item or completed project, with a `waiting_since`), longest wait first, with who, where, due date and
  the days waited. Per task: **Followed up** (`POST /api/tasks/{id}/follow-up` sets `waiting_since` to now, so `waiting_since` means
  "start of the wait or last follow-up" and the Dashboard's "waiting too long" restarts too), **Received, done** (completes it) or
  **Not waiting anymore** (clears `waiting_for`). After an action the row stays, dimmed, with the outcome; the list is not refetched mid-step.
- **Someday** (`components/review/SomedayStep.tsx`, uses `GET /api/tasks/someday`): parked ideas oldest first with where they live and how
  long they have been parked. **Start it** (`is_someday` off), **Keep parked** (nothing changes) or **Drop** (deletes, with the usual Undo toast).
- **Summary** has three new counters: waiting tasks followed up or closed, Someday ideas started, dropped.
- Shared pieces: `ReviewTaskRow.tsx`; hooks `useReviewWaiting`, `useFollowUpTask`, `usePatchTask` (any task by id).
  `dashboard_service.get_waiting_tasks(..., min_days)` serves both the Dashboard (7+ days) and the review (all); waiting days are never negative.
- The step bar is wider (`max-w-[1160px]`) so eight labels fit on one line.
- **Old steps reviewed and fixed in the same change** (found by reading them, not reported by the owner):
  - Resources: "Update" navigated to the resource inside the same tab and so left the review, losing its position and the Summary counts. It is now a link that opens in a new tab.
  - Inbox: a second keypress/click while an action was still saving acted on the same task again; actions now run one at a time and a failed save leaves the task where it is. A completed project is no longer offered as a destination. "Someday [M]" shows an error message when it fails.
  - Projects: every project can get a next step right in the review ("Add a next step…", counted in the Summary as "Next steps added"; the Areas step counts too); a project with no open tasks shows a warning; Someday tasks are no longer listed (they have their own step); failed complete/archive no longer throw unhandled errors.
  - A wait with no recorded `waiting_since` (old data) is still listed in the Waiting for step (as 0 days) but never counts as "waiting too long".
- Seen but left as it was: the Inbox step still pre-selects the first project/area in its dropdowns, so one press of [P] files the task there without choosing; there is no "Waiting for" action in the Inbox step.
- Not done: saving progress to continue a review later.
