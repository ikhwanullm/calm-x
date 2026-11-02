# Smart capture, Inbox triage and the project picker

Part of the Calm-X docs; start at [`docs/HANDOVER.md`](../HANDOVER.md). Describes what is built, for coding sessions.

## Smart capture and Inbox triage (built 2026-10-30; the owner asked for ideas 1-3 of my Inbox list)

- **Capture syntax** (`utils/capture.ts`, pure and tested): `!high|!medium|!low` (also `!h/!m/!l`, `!tinggi/!sedang/!rendah`), `#tag`,
  `@name` or `@"two words"` for a project or area, and a due date as `today/hari ini`, `tomorrow/besok`, `lusa`, a weekday in English or
  Indonesian (the next one after today, never today itself), `+3d`/`+2w` or `2026-11-05`. A backslash keeps a word plain (`\besok` stays `besok`). Only the
  first date and priority count. A marker that matches nothing stays in the title, and an `@name` that matches several projects is not guessed
  (exact title, else a whole word of exactly one title, else a part of exactly one). A line made only of markers keeps the whole line as the title.
  Completed projects are not offered.
- **`components/capture/CaptureBox.tsx`** (used by the Inbox page and the Q dialog): a text box where Enter adds and Shift+Enter starts a new
  line, so a pasted list becomes one task per line (bullets, numbers and `[ ]` are dropped; at most 50 lines at once). A preview lists how each
  line was read (date, priority, tags, project, unmatched markers) whenever a marker was read or there are several lines. Lines are created one by
  one with `tasksApi.create`; lines that fail stay in the box as typed. The toast names where tasks went ("Added to Inbox", "Added 3 tasks to X").
  Only the Inbox page and Q dialog use it; the project quick-add field (detail page) and the Areas review step still take a plain title.
- **Inbox row menu** (⋯): Add to Today, Set due date…, Waiting for… (asks who), Move to Someday, Delete (with confirmation and Undo).
  **Bulk bar** for the selection: Move to…, Priority…, Today, Due date…, Waiting for…, Add tag… (adds to each task's own tags), Someday,
  Delete (one Undo restores all). `hooks/useTriage.ts` tries every task, then reports how many worked and the first reason for any that did not.
- Not done: a "process one by one" mode on the Inbox page, showing how old each Inbox task is, a description field at capture time.

## Searchable project/area picker (built 2026-10-30; the owner pointed out a native dropdown does not scale to 100+ projects)

`components/common/ItemPicker.tsx` (cmdk, no new dependency): a button that opens a list with a search box. Typing narrows it by the
project's title or its area's name (a title that starts with the text comes first), arrows and Enter choose, Escape or a click outside closes,
and the last five destinations used are listed first under "Recent" (`localStorage` key `calmx.recentDestinations`, works without storage).
It opens upwards when there is more room above and lines up with the right edge when it would run off the screen. `allowInbox` adds an
"Inbox" entry that selects `null`.

- Used for: the Inbox row "Move to…" and the bulk bar's "Move to…", the task drawer's "Move to…", the Inbox step of the Weekly Review (project and
  area), and "Link to…" on a Resource page.
- Still native selects with a few items: the area of a project, the Projects page area filter, the new item dialog. If a list there ever grows, use `ItemPicker`.
- `test-setup.ts` now stubs `ResizeObserver` and `scrollIntoView` (cmdk needs them under jsdom).
- Not done: `LinkedResourcesSection` ("link a resource") still uses a native select over resources; do the same when the number of resources grows.
