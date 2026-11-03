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

## Icon and color per Project and Area (built 2026-11-03, designed with the owner: "option 3", line icons with a soft tint)

- Data: migration `010_item_icon.py` adds `items.icon` and `items.color` (NULL for existing rows). The backend accepts any icon key
  matching `^[a-z0-9-]{1,40}$` and one of `purple|blue|teal|pink|slate` as color (400 otherwise); every item type may have them, but
  only Projects and Areas get the picker. An explicit `null` in `PUT /api/items/{id}` removes a value. Both are in item responses, in
  task responses as `item_icon` / `item_color` (same four queries), in the Dashboard's attention projects, and in export/import.
- Frontend: `utils/itemIcons.ts` (40 lucide icons in Work / Life / General, the five colors), `components/common/ItemIcon.tsx`
  (rounded square in the tint; sizes 16, 20, 28; the first letter of the title in a slate square when there is no icon or the key is
  unknown; `aria-hidden`), `components/common/ItemIconPicker.tsx` (Radix popover: search, grid with arrow keys, five swatches, "Remove icon";
  saves at once through `useUpdateItem`; read-only on archived items), tokens `--tint-*` in `index.css` (see ui-guidelines §1 and §3).
- Shown in: Projects and Areas cards and list rows, the detail header (the picker), the project/area name on task rows, the compact list
  and the drawer footer (`ItemLink`, 16 px), `ItemPicker` entries, the Dashboard's projects needing attention. Not in the week strip, not on
  Resources, not in the sidebar.
- Chosen by me: "Remove icon" clears both the icon and the color; items without an icon show their first letter everywhere, not only in the
  picker, so a list never mixes squares and bare names.
- Not checked by eye: the browser pane was too small for screenshots, so contrast was computed and the layout inspected through the DOM.
  Look at the blue tint next to the accent color; if it reads too close, drop `blue` from `ITEM_COLORS` (the backend can keep accepting it).
