# Calm-X UI Prototype

The approved visual reference for Calm-X v1. Open `index.html` in a browser (double-click works; no server needed).

| File | Screen |
|---|---|
| `Main.dc.html` | Dashboard |
| `Project.dc.html` | Project detail + task drawer |
| `Review.dc.html` | Weekly review |

Add `?dark=1` to any screen for dark mode, or use the toolbar at the bottom-left.

## How to use it when building the app

- **Use it for:** layout, spacing, sizes, color tokens, copy, states and interaction behavior. The design tokens appear in each screen's `renderVals()` (`LIGHT` / `DARK`) and match `.kiro/steering/ui-guidelines.md` §3.
- **Do not copy its code.** The markup uses inline styles and a prototype-only template format. Rebuild every screen with React, shadcn/ui, Tailwind tokens and the shared components defined in the UI guidelines.
- `runtime.js` is a small shim that renders the prototype format in a browser. It is not part of the application and must not be imported by it.
- When the prototype and the spec disagree, the spec (`requirements.md`, `design.md`, `ui-guidelines.md`) wins. Raise the difference instead of guessing.

## Known simplifications

- The "Reset all subtasks?" confirmation (R8.9) is not shown; unchecking a task resets its subtasks directly.
- Keyboard shortcuts are shown as hints only; drag handles do not reorder.
- Inbox, Areas, Resources, Archive, Templates and Settings screens are not included; build them from the same components and patterns.
