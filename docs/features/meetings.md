# Meeting notes

Part of the Calm-X docs; start at [`docs/HANDOVER.md`](../HANDOVER.md). Describes what is built, for coding sessions.

## Meeting notes (designed with the owner, 2026-10-29)

The owner has 3–5 meetings a week, almost always about one project. Notes are for the owner only (nothing is shared or
sent). **Parts A and B are built.**

### Decisions already made

- A meeting belongs to exactly **one Project or Area** (not a Resource; not an archived item). No multi-item links.
- The body is **Markdown** (GitHub-flavoured, incl. task lists). Rendered with `react-markdown` + `remark-gfm` (added in part A):
  raw HTML is never rendered (shown as text), `javascript:` links are dropped, links open in a new tab with `rel="noopener noreferrer"`.
- No separate "series" entity: continuity comes from **carrying over** the previous meeting of the same item (part B).
- Action items for other people only become Waiting-for tasks for the owner. No export/share.

### Part A: how it works (done)

- **Data**: `meetings` (`item_id` CASCADE, `title` ≤200, `held_at` UTC, `attendees` ≤500, `body` ≤50 000, `processed_at`) and
  `tasks.meeting_id` (ON DELETE SET NULL). Export/import carry both (`meetings` is optional in files, so older exports
  still import; merge inserts meetings before tasks and remaps `meeting_id`). Replace import wipes `meetings`.
- **Line syntax** (`services/meeting_parser.py`, one function for the preview and the process endpoint; indentation and a
  `-`/`*`/`+` list marker are ignored; fenced code blocks and lines without text are ignored):
  `[ ] text` my action, `@Who: text` someone else's action (Waiting-for task), `? text` question, `! text` decision.
  Processed lines become `[→] text` / `@→Who: text` and are only counted.
  **Actions are optional** (chosen by the owner 2026-11-03): a line `[x] text` / `[X] text` is **closed** (handled without a task); it
  is only counted (`closed`) and wins over the other rules, so `[x] @Who: text` is closed too. The side panel has **Done, no task** next
  to each open action: `POST /api/meetings/{id}/close-lines` with `{lines: [{line, text}]}` rewrites `[ ] text` to `[x] text` and
  `@Who: text` to `[x] @Who: text` in the saved notes, with the same stale check as `process` (409 and no change when a line moved or
  changed; all or nothing; a line chosen twice is 400; archived item 403). The page saves typing first and shows the new body.
  `GET /api/meetings/{id}/actions` returns `closed`, shown as "N done without a task".
  **Nothing more to process** (migration 011, `meetings.actions_closed_at`): `POST /api/meetings/{id}/close-actions` sets it and
  `POST /api/meetings/{id}/reopen-actions` clears it (archived item: 403). A closed meeting is never "to process": its
  `open_action_count` is 0 everywhere (lists, review step), so `get_review_meetings` leaves it out. The lines stay in the notes; new lines
  typed later do not reopen it; `process` still works and does not change the flag. In `MeetingSummary`/`MeetingResponse`, export/import
  (optional in files) and the meeting undo snapshot. Meeting page: a quiet "Nothing more to process" under Process actions when there
  are open actions; when closed the panel says "Actions closed {when} · Reopen" and lists the remaining lines muted as "Not turned into tasks".
- **API** (`api/meetings.py`): `GET/POST /api/items/{id}/meetings`, `GET /api/meetings?q=` (title, attendees, notes),
  `GET/PUT/DELETE /api/meetings/{id}`, `POST /api/meetings/{id}/restore` (Undo), `GET /api/meetings/{id}/actions`,
  `POST /api/meetings/{id}/process`. Process re-parses the saved notes and refuses (409, nothing created) if a chosen line
  moved or changed; it is all-or-nothing, respects the 100-task limit, and puts a title longer than 200 chars in the
  description. Tasks carry `meeting_id`, `meeting_title`, `meeting_held_at`.
- **Undo** of a deleted meeting (`undo_entries` kind `meeting`, 24 h) re-creates it and re-links its tasks that still exist.
  Unlike tasks it cannot fall back to the Inbox: if the Project/Area is gone (404) or archived (403) the restore is refused.
- **Search**: `/api/search` also returns `type: "meeting"` rows; the command palette has a Meetings group.
- **UI**: `MeetingsSection` on Project/Area pages (+ Meeting creates "{item} meeting" with the template and opens it),
  `/meetings/:id` (Edit/Preview, autosave ~1 s + on blur + on leaving, "Saved / Unsaved changes / Couldn't save" status,
  side panel with the parsed lines, Process dialog with due date and priority per line), `/meetings` (search, grouped by
  week, Monday start), sidebar entry, task drawer link. `hooks/useAutosave.ts` is generic (debounce, merged patches, flush,
  retry, `beforeunload` warning).
- **Chosen by me, not by the owner**: an item that has meetings **cannot be converted to a Resource** (400, "delete them
  first"), because meetings can't live on a Resource and silently deleting notes is worse. Meetings of an archived item are
  read-only (also not deletable), like its tasks.
- Not done in A: moving a meeting to another item, a meeting count on the Projects list, natural-language dates in lines.

### Part B: how it works (done)

- **Carry-over**: `GET /api/items/{id}/meetings/carry-over` returns the item's newest meeting (by `held_at`) with its `?` lines and
  the tasks made from it that are still open (`null` when the item has no meetings). `+ Meeting` always asks for it (the
  meetings list may still be loading), and `buildMeetingBody` in `utils/meeting.ts` puts a "From last meeting" block above the
  template: a link to that meeting, its questions as `?` lines (so they stay questions in the new notes), and open tasks as
  plain `- Task: …` bullets. Tasks have no URL of their own, hence no links; the `Task:` prefix keeps a title like `? x` or
  `[ ] x` from being read as a meeting line. If the lookup fails the plain template is used.
- **Weekly Review**: new step "Meetings" after Inbox (`MeetingsStep`, `GET /api/weekly-review/meetings?today=&tz_offset=`):
  meetings of the last 7 days (today included, client timezone) that still have actions to process, items not archived,
  newest first. "Process" opens the meeting in a new tab so the review keeps its place; the list refetches when the tab
  regains focus. Processing happens on the meeting page, not inside the review.
- Decisions (`! `) and created tasks stay queryable for the future weekly report: `GET /api/meetings/{id}/actions` has the
  decisions, and `tasks.meeting_id` links tasks to meetings.
- Not done: processing from inside the review step; counting meetings in the review summary.
