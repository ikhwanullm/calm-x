---
inclusion: fileMatch
fileMatchPattern: "frontend/**/*"
---

# Calm-X UI Guidelines

These rules apply to every frontend change. The approved visual reference is the
Calm-X UI Prototype in `docs/prototype/` (open `index.html` in a browser:
Dashboard, Project detail + task drawer, Weekly review; add `?dark=1` for dark
mode). Use it for look, layout and behavior. **Do not copy its HTML or
`runtime.js`**: rebuild every screen with the components and tokens below.

When a screen is not covered by the prototype, compose it from the same
components and patterns. Do not invent new colors, font sizes or one-off styles.

## 1. Principles

1. **Calm by default.** Neutral surfaces, generous whitespace, one accent color.
   Nothing on screen competes for attention unless it needs action.
2. **Color means status, and only status.** Red, amber and green appear only for
   deadline status (overdue, approaching, on track) and success/error feedback.
   Status is never shown by color alone: always icon + text (+ `aria-label`).
3. **Fast to capture, quick to process.** Quick capture is reachable from every
   screen. Common actions are one click or one key away.
4. **Show the next action.** Every list has an empty state that says what to do
   next. Every destructive action is clearly labelled.
5. **Keyboard first, accessible always.** Every action works with Tab, Enter,
   Space and Escape, and every text meets WCAG 2.1 AA contrast.

## 2. Stack

| Concern | Library | Notes |
|---|---|---|
| Components | **shadcn/ui** (Radix primitives) | Generated into `frontend/src/components/ui/`. Theme them via the tokens below; do not restyle per page. |
| Styling | **Tailwind CSS** | Utility classes that reference tokens only (`bg-surface`, `text-muted`). No raw hex values in components. |
| Icons | **lucide-react** | Stroke width 1.75, size 16 (inline) or 18 (navigation). Decorative icons get `aria-hidden`. |
| Toasts | **sonner** | Bottom-right. Minimum duration 3000 ms (R15.6). |
| Command palette | **cmdk** (shadcn `Command`) | Global search and command palette (`Ctrl+K`). |
| Drag and drop | **@dnd-kit/core** + `@dnd-kit/sortable` | Pointer **and** keyboard sensors are required. |
| Dates | **date-fns** | All relative/absolute formatting goes through `utils/date.ts`. |
| Theme | Class strategy (`.dark` on `<html>`) | Small `ThemeProvider` with values `system | light | dark`. |

**shadcn component overrides:** Every shadcn component generated into `components/ui/` must be adjusted after generation:

- Replace all `hsl(var(--...)))` patterns with plain `var(--...)` — shadcn generates hsl wrappers that conflict with Calm-X direct hex tokens.
- Replace `bg-accent text-accent-foreground` (hover state) with `bg-surface-2 text-text`.
- Replace `bg-muted` with `bg-surface-2`.
- Replace `text-muted-foreground` with `text-muted`.

> **Opacity modifier rule:** The /N opacity modifier (e.g. `bg-primary/90`) does NOT work with
> `var(--...)` tokens. Use `hover:opacity-90` or a dedicated hover token (e.g. `hover:bg-surface-2`) instead.


> **Opacity modifier rule:** The /N opacity modifier (e.g. g-primary/90) does NOT work with
> ar(--...) tokens because CSS color-mix() is not universally supported. Use opacity-90 on the
> element or a dedicated hover token (e.g. hover:opacity-90, hover:bg-surface-2) instead.
## 3. Design tokens

Define tokens once as CSS variables in `frontend/src/index.css` and expose them
in `tailwind.config.ts` (`colors: { bg: 'var(--bg)', ... }`). Map the shadcn
variable names to the same values so generated components match.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F6F6F3` | `#131312` | App background |
| `--surface` | `#FFFFFF` | `#1B1B1A` | Cards, sidebar, header, drawer, dialogs |
| `--surface-2` | `#EFEFEA` | `#2A2A27` | Chips, tags, count pills, subtle fills |
| `--border` | `#E3E3DE` | `#2F2F2C` | All borders and dividers |
| `--text` | `#1B1B19` | `#ECECE8` | Primary text |
| `--muted` | `#5C5C57` | `#A6A6A0` | Secondary text, labels, inactive nav |
| `--accent` | `#3B5BDB` | `#8EA2FF` | Primary buttons, progress bars, focus ring, checkbox accent |
| `--accent-fg` | `#FFFFFF` | `#10142B` | Text/icons on `--accent` |
| `--accent-soft` | `#EEF2FF` | `#1F2547` | Active nav item, selected row, current step |
| `--accent-text` | `#3049B8` | `#AEBBFF` | Links and accent text on surfaces |
| `--danger-bg` / `--danger-fg` | `#FEF1F0` / `#B42318` | `#3A1614` / `#FFA59C` | Overdue badge, destructive text, errors |
| `--warn-bg` / `--warn-fg` | `#FFF4E0` / `#8A4B00` | `#352509` / `#F7C35F` | Approaching-deadline badge, stale suggestions |
| `--ok-bg` / `--ok-fg` | `#EBF8F0` / `#106B3E` | `#0F2A1B` / `#7BDCA6` | On-track badge, "Ready for completion", success |
| `--track` | `#E8E8E3` | `#2C2C29` | Progress bar track |
| `--shadow` | `0 1px 2px rgba(20,20,18,.05)` | `none` | Cards only |

shadcn mapping: `--background → --bg`, `--card`/`--popover → --surface`,
`--foreground → --text`, `--muted-foreground → --muted`, `--primary → --accent`,
`--primary-foreground → --accent-fg`, `--secondary`/`--accent (shadcn) → --surface-2`,
`--destructive → --danger-fg`, `--border`/`--input → --border`, `--ring → --accent`.

Rules:
- Do not add a color without adding it here first, with light and dark values that pass AA.
- Text on any `*-bg` token uses its matching `*-fg` token. Never put muted text on a status background.

### Typography

Font: **Inter** (400, 500, 600, 700), fallback `system-ui, -apple-system, sans-serif`.
Use `font-variant-numeric: tabular-nums` for counts, percentages and dates in tables.

| Role | Size / line height | Weight | Extra |
|---|---|---|---|
| Page title (h1) | 26px / 1.25 | 600 | `letter-spacing: -0.02em` |
| Review step title | 24px / 1.25 | 600 | `-0.02em` |
| Drawer / card title (h2) | 19–20px / 1.35 | 600 | |
| Section title | 15px / 1.4 | 600 | |
| Body (default) | 14px / 1.5 | 400 | |
| Small / meta | 13px / 1.45 | 400–500 | `--muted` |
| Caption, badge, chip | 12px / 1.4 | 600 | |
| Stat number | 32px / 1.1 | 600 | `-0.02em`, tabular |

### Spacing, radius, elevation

- 4px base grid. Common steps: 4, 8, 12, 16, 20, 24, 32.
- Page padding 32px. Card padding 20px. Gap between cards 16px. Gap between page sections 24–28px.
- Radius: 8px controls (buttons, inputs, nav items), 12px cards and list containers, 14–16px dialogs and large panels, 999px pills and badges.
- Elevation: cards use `--shadow`. Dialogs and toasts use a stronger shadow. Nothing else casts a shadow.
- Borders: 1px `--border` on every card, input, divider and panel edge.

## 4. Layout

- **App shell:** sidebar (232px) + main column. Main column = header (search, Quick capture) + page content (`max-width: 1240px`).
- **Sidebar order:** Dashboard, Inbox (count pill), Projects, Areas, Resources, Archive, divider, Templates, Weekly review, Settings. The active item uses `aria-current="page"` with `--accent-soft` background and `--accent-text`.
- **Breakpoints:**
  - `≥1280px`: full sidebar; Dashboard cards in 3 columns; task drawer sits beside the list.
  - `768–1279px`: sidebar collapses to a 64px icon rail (tooltips on hover/focus); cards in 2 columns; the task drawer overlays the content from the right.
  - `<768px`: not supported in v1, but must not break: content stacks, no horizontal page scroll.
- **Weekly review** is a focused mode: no sidebar, top bar with "Exit review", a stepper and a sticky footer with Back/Next.

## 5. Components

Build these once in `frontend/src/components/common/` and reuse them everywhere.

| Component | Spec |
|---|---|
| `Button` | Variants: `primary` (accent fill), `secondary` (surface + border), `ghost` (transparent, accent text), `danger` (transparent, `--danger-fg` text). Sizes: `default` 44px, `sm` 36px. Icon-only buttons need `aria-label`. |
| `StatusBadge` | Props: `status: 'overdue' \| 'approaching' \| 'on-track'`, `date`. Pill, 24px high, icon + label + `<RelativeDate>`. Icons: `AlertCircle` (overdue), `Clock` (approaching), `CheckCircle2` (on track). `aria-label`: "overdue", "approaching deadline", "on track". **Renders nothing for completed tasks** (R8.13–R8.15, R9.4). |
| `RelativeDate` | Renders `<time datetime="YYYY-MM-DD" title="Thu, 29 Oct 2026">In 3 days</time>` with a dotted underline. Rules in §7. |
| `ProgressBar` | `role="progressbar"`, `aria-valuenow/min/max`, an `aria-label`, 6–8px high, `--track` background, `--accent` fill, percentage label next to it. Uses `calculateProgress()`, never its own math. |
| `Card` | Surface, 1px border, 12px radius, `--shadow`, 20px padding. Clickable cards are `<a>`/`<Link>`, not `div onClick`. |
| `TaskRow` | Drag handle (button, `aria-label="Reorder {title}"`), checkbox (`aria-label="Mark complete: {title}"`), title button that opens the drawer, meta line (priority, subtasks `2/4`, tags), status badge on the right. Min height 52px. Selected row uses `--accent-soft`. Completed rows: muted, line-through, grouped under "Show N completed". |
| `TaskDrawer` | shadcn `Sheet`, right side, 360–460px wide. Sections: header (checkbox + title), details list (Project/Area, Priority, Due, Tags), Subtasks (progress + checklist + "Add subtask"), Description, footer (Move to…, Delete task). Escape closes it and returns focus to the row. |
| `PriorityChip` | Neutral chip (`--surface-2`), text "High / Medium / Low". Priority never uses status colors. |
| `TagChip` | `#name`, `--surface-2` background, 4px radius, 12–13px. |
| `EmptyState` | Short title, one sentence of guidance, optional primary action. Dashed border when it replaces a list. |
| `ConfirmDialog` | shadcn `AlertDialog`. Only for destructive or irreversible actions (see §6). Destructive button uses `danger` styling and states the action ("Delete project"). |
| `Kbd` | Shortcut hint, 12px, bordered. |

## 6. Interaction patterns

- **Optimistic updates.** Checkbox toggles, reordering, moving tasks and inline edits update the UI immediately through TanStack Query `onMutate`. On failure: roll back from the snapshot, show an error toast with the server message (R13.8).
- **Loading.** Show a skeleton if data takes more than 200 ms (R15.5). Never block the whole page with a spinner. Buttons show a spinner while their own request is in flight.
- **Feedback.** Success and error toasts stay at least 3 s (R15.6). Use `role="status"` for success and `role="alert"` for errors.
- **Confirmation.** Required for: deleting an Item (and its tasks), deleting from Archive (R7.10), import in *replace* mode, marking a completed task with subtasks as incomplete ("Reset all subtasks to incomplete?", R8.9). Not required for deleting a single task or subtask: use an undo toast instead.
- **Task ↔ subtask sync** (R8.6–R8.10) is shown immediately in the UI: completing the last subtask completes the task; unchecking any subtask reopens the task; adding a subtask to a completed task reopens it.
- **Ready for completion.** When all tasks in a project are done (and there is at least one), show the success banner with a "Complete project" action (R4.7).
- **Inline edit** for titles: click or Enter to edit, Enter to save, Escape to cancel. Validation errors appear under the field, never as alerts.
- **Archived items are read-only** (R7.2): show a "Read-only · Archived" banner with Restore and Delete actions; disable editing controls (do not hide the data).
- **Drag and drop:** the handle is the only drag target. Keyboard: focus the handle, Space to lift, arrow keys to move, Space to drop, Escape to cancel. Announce moves to screen readers.
- **Focus.** Dialogs and drawers trap focus and return it to the trigger when closed. After deleting a row, move focus to the next row.

## 7. Dates

All formatting lives in `utils/date.ts` and uses the client's local date (R8.18).

| Difference from today | Label |
|---|---|
| 0 | Today |
| +1 / −1 | Tomorrow / Yesterday |
| +2 … +90 | In N days |
| −2 … −90 | N days ago |
| beyond ±90 days | Absolute short date, e.g. `17 Dec` (add the year if it is not the current year) |

- The tooltip (`title`) and `datetime` are always the absolute date: `EEE, d MMM yyyy` (e.g. "Thu, 29 Oct 2026").
- Labels start with a capital letter when they stand alone ("In 3 days") and with lowercase inside a sentence ("Nearest deadline in 3 days").
- Badges combine status and date: "Due in 3 days", "Overdue · Yesterday".

## 8. Keyboard shortcuts

Shortcuts never fire while the focus is in an input, textarea or select.

| Key | Action |
|---|---|
| `Q` | Open Quick capture (R3.2) |
| `/` | Focus search |
| `Ctrl/⌘ + K` | Open command palette (search + navigation + actions) |
| `?` | Show the shortcut list |
| `Esc` | Close dialog, drawer or palette |
| `Enter` | Activate the focused element / submit a form |
| Weekly review | `P` move to project, `A` move to area, `C` complete, `D` delete, `S` skip, `→` next step |

## 9. Accessibility checklist

- Real elements only: `<button>`, `<a href>`/`<Link>`, `<input>` with `<label>`. No `div onClick`.
- Visible focus ring on every interactive element: 2px `--accent` outline with 2px offset.
- Contrast: body text ≥ 4.5:1, large text and UI boundaries ≥ 3:1, in both themes.
- Icon-only buttons have `aria-label`. Decorative SVG has `aria-hidden="true"`.
- Landmarks: `<nav aria-label="Main">`, `<header>`, `<main>`, `<aside aria-label="Task details">`.
- Progress, status and counts are exposed to assistive technology (`role="progressbar"`, `role="status"`, `aria-current`).
- Touch/click targets are at least 36px, 44px for primary actions and nav items.

## 10. Copy

- UI language: **English**, sentence case ("Start weekly review", not "Start Weekly Review").
- Short and direct. Name the action on buttons ("Move to project", "Delete task"), never "OK"/"Submit".
- Empty states encourage, without exclamation marks: "No open tasks. Nice work."
- Error messages say what happened and what to do: "Couldn't save the task. Check that the server is running and try again."

## 11. Don'ts

- No raw hex colors, ad-hoc font sizes or inline styles in components.
- No status colors for decoration, priority or categories.
- No gradients, glows, emoji in UI chrome, or left-border accent cards.
- No modal for task details: use the drawer.
- No confirmation dialogs for reversible actions: use an undo toast.
- No layout shift when data loads: reserve space with skeletons.

