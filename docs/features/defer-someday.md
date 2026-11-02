# Defer and Someday

Part of the Calm-X docs; start at [`docs/HANDOVER.md`](../HANDOVER.md). Describes what is built, for coding sessions.

## Defer + Someday: how it behaves (decided with the owner, 2026-10-29)

- **Defer** (`defer_until`, local date): the task is hidden from Today (all four lists) until that date.
  In Project/Area/Inbox/All-tasks lists it stays visible, dimmed, with a "Starts {date}" chip.
- **Someday** (`is_someday`): parked idea. Hidden from Today, from the Inbox page, the Weekly Review Inbox step and the
  dashboard inbox count. Listed on `/someday` (open tasks of non-archived items). Still shown dimmed with a "Someday"
  chip in Project/Area lists and All tasks. Moving it back to active returns it to where it was (an Inbox task is back in the Inbox).
- **Validation**: `due_date < defer_until` is rejected with 400 (checked against the merged old + new values).
- Export/import and undo snapshots carry both fields; old undo snapshots without them restore as not deferred/not someday.
- Not done: no "show deferred" filter, and Someday tasks are not excluded from search or tag filters.
