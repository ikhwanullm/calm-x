# Project, Area and Resource detail page

Part of the Calm-X docs; start at [`docs/HANDOVER.md`](../HANDOVER.md). Describes what is built, for coding sessions.

## Project and Area detail page (reviewed and reworked 2026-10-30, not designed with the owner)

`components/items/ItemDetailView.tsx` (also used for Resources; since the code health round its pieces live in
`components/items/detail/`: `ItemHeader`, `TasksSection`, `InlineTitle`, `InlineField`, `InlineDeadline`). Found in a read-only review, then fixed:

- **Drag-reorder of tasks did nothing**: the hook, API and `TaskList` support existed but `TasksSection` never passed `onReorder`.
  Now wired; `useReorderTasks` (in `hooks/useTasks.ts`) updates the list at once, keeps completed tasks in their slots, and
  puts the old order back with an error toast if the server refuses. It also refreshes the item (its "Next task" can change).
- **Quick add**: "+ Add task" (which created a task called "New task" and opened the drawer) is replaced by a text field:
  type a title, Enter, the task is created and the field stays ready; a failed create keeps the text; disabled at 100 tasks.
- **Summary strip** (`components/items/ItemSummary.tsx`) under the progress bar, for Projects and Areas: open, overdue, waiting
  (only if any), next task (a link that opens its drawer) and the next/last meeting; Areas also show their project count.
  Data: `GET /api/items/{id}?today=YYYY-MM-DD` now adds `stats` like the list does (`useItem` always sends today).
  For an Area the task numbers are the Area's own tasks, as on the Areas list.
- **Order and width**: title and header, deadline, area, goal, progress, summary, description, (Area: its projects), **tasks, meetings**,
  (Area: maintenance notes), notes, reference links, linked resources. Width `max-w-4xl` (was `max-w-2xl`).
- The delete confirmation now says "and meeting notes" for Projects and Areas.
- Test gotcha: detail-page tests that mock `../hooks/useTasks` must include `useReorderTasks` (added to `ItemDetailView.test.tsx` and `ProjectDeadline.test.tsx`).
- Not done: the Area page still shows its own tasks and its projects separately (no combined task list), and `AreaProjectsSection` was not reviewed.
