# Implementation Plan: Calm-X PARA Task Manager

## Overview

This implementation plan covers the full-stack development of Calm-X, a local task management web application implementing the PARA Method. The backend uses FastAPI with SQLAlchemy 2.0 (synchronous) and SQLite with WAL mode. The frontend uses React 18 with TypeScript, TanStack Query for server state, Zustand for UI state, and shadcn/ui components styled per `.kiro/steering/ui-guidelines.md`.

Each phase ends with a runnable application and a checkpoint that includes both automated tests and manual browser verification.

## Review Notes (added after Phase 0 review)

### Phase 4 / Phase 6: AppShell header improvements
When implementing Quick Capture (Phase 4) and the command palette (Phase 6), the AppShell header must be updated:
- Quick Capture button: min height 44px (primary action), label "Quick capture", with <Kbd>Q</Kbd> shortcut hint
- Search input: opens command palette on click/focus (not a standalone input) — use Phase 6 CommandPalette
- Secondary nav group (Templates, Weekly review, Settings): wrap in a second <nav aria-label="Secondary"> landmark

### Phase 9: Weekly Review — remove from AppShell
/review must render in **focused mode** (no sidebar, no app header — only "Exit review" top bar + stepper + sticky footer).
When implementing Phase 9, move the /review route **outside** the AppShell layout and render WeeklyReviewPage directly without the sidebar shell.

## Tasks

- [x] 0. Phase 0: Foundation
  - [x] 0.1 Initialize project with git
    - Run `git init` in project root
    - Create `.gitignore` with Python, Node, IDE, and data directory entries
    - _Requirements: N/A (project setup)_

  - [x] 0.2 Create backend skeleton structure
    - Create `backend/` directory with `__init__.py`
    - Create subdirectories: `api/`, `models/`, `schemas/`, `services/`, `middleware/`, `migrations/`
    - Create `pyproject.toml` with dependencies: fastapi, uvicorn, sqlalchemy (2.0+), pydantic (2.0+), pydantic-settings, alembic, pytest, hypothesis
    - _Requirements: R13.1, R15.1_

  - [x] 0.3 Implement config.py with pydantic-settings
    - Create `Config` class with fields: db_path, backup_dir, frontend_dist, port (default 8080), dev_origins
    - Implement `project_root`, `absolute_db_path`, `absolute_backup_dir`, `absolute_frontend_dist` properties
    - Implement `load_config()` with CLI port override support
    - Support `CALM_X_PORT` environment variable and `--port` argument
    - _Requirements: R15.1, R15.2_

  - [x] 0.4 Implement database.py with SQLite PRAGMA and programmatic Alembic
    - Create SQLAlchemy engine with WAL mode and foreign keys via `@event.listens_for(Engine, "connect")`
    - Implement `get_session()` context manager with automatic rollback on error
    - Implement `init_database()` that runs Alembic migrations programmatically (no alembic.ini file)
    - Create `migrations/env.py` and `migrations/script.py.mako` for Alembic
    - _Requirements: R13.1, R13.7_

  - [x] 0.5 Implement UTCDateTime TypeDecorator
    - Create `backend/models/types.py` with `UTCDateTime` TypeDecorator
    - Implement `process_bind_param()` to convert timezone-aware to naive UTC for storage
    - Implement `process_result_value()` to return timezone-aware UTC on load
    - _Requirements: R13.1_

  - [x] 0.6 Implement exceptions.py with unified error handling
    - Create `CalmXException` base class
    - Create subclasses: `ValidationError`, `ImportValidationError`, `LimitExceededError`, `ArchivedItemError`, `NotFoundError`, `ConflictError`, `ImportFailedError`
    - Create `EXCEPTION_STATUS_MAP` for HTTP status codes
    - Create `get_exception_type_name()` helper
    - _Requirements: R7.2, R13.8_

  - [x] 0.7 Implement CSRF middleware
    - Create `backend/middleware/csrf.py` with `CSRFProtectionMiddleware`
    - Validate `X-Calm-X: 1` header on all non-GET requests
    - Validate Origin header against allowed origins (localhost:port, 127.0.0.1:port)
    - Support `CALM_X_DEV_ORIGINS` environment variable for Vite dev server
    - Return 403 JSON error on validation failure
    - _Requirements: R15.3_

  - [x] 0.8 Implement main.py with port check and SPA fallback
    - Implement `check_port_available()` using socket binding test
    - Implement `create_app()` factory with:
      - TrustedHostMiddleware for localhost/127.0.0.1
      - CSRFProtectionMiddleware
      - Exception handlers for RequestValidationError, IntegrityError, CalmXException
    - Mount `/assets` from `frontend/dist/assets` if exists
    - Implement SPA fallback: serve static files from dist root, fall back to index.html for non-API routes
    - Implement `main()` with argparse for `--port`, config loading, directory creation, database init, uvicorn run
    - Exit with error if port unavailable
    - _Requirements: R15.1, R15.2, R15.9_

  - [x] 0.9 Initialize React frontend with Vite
    - Create Vite + React + TypeScript project in `frontend/`
    - Configure `vite.config.ts` with proxy: `/api` → `http://127.0.0.1:8080`
    - Install dependencies: @tanstack/react-query, zustand, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, react-router-dom, axios, date-fns, cmdk, sonner, lucide-react
    - Install dev dependencies: vitest, @testing-library/react, @testing-library/user-event, jsdom, fast-check
    - Configure vitest in vite.config.ts with jsdom environment
    - _Requirements: R15.4_

  - [x] 0.10 Configure Tailwind CSS with design tokens
    - Install and configure Tailwind CSS
    - Create `frontend/src/index.css` with CSS variables for all tokens from ui-guidelines.md §3 (light and dark themes)
    - Configure `tailwind.config.ts` to reference CSS variables
    - Map shadcn variable names to design tokens
    - _Requirements: R16.5; ui-guidelines.md §3_

  - [x] 0.11 Set up shadcn/ui and Inter font
    - Initialize shadcn/ui with Tailwind integration
    - Add Inter font via Google Fonts or local files
    - Configure font-family in Tailwind config
    - _Requirements: ui-guidelines.md §2, §3_

  - [x] 0.12 Implement ThemeProvider with system/light/dark
    - Create `frontend/src/components/ThemeProvider.tsx`
    - Support values: `system`, `light`, `dark`
    - Apply `.dark` class to `<html>` element for dark mode
    - Store preference in localStorage initially (backend persistence comes in Phase 10)
    - Add inline script in index.html `<head>` that reads theme from localStorage and applies class to `<html>` BEFORE React hydration to prevent flash of wrong theme
    - _Requirements: R16.5; ui-guidelines.md §3_

  - [x] 0.13 Set up React Router with all routes
    - Configure react-router-dom with routes:
      - `/` → Dashboard
      - `/inbox` → Inbox
      - `/projects`, `/projects/:id` → Projects list/detail
      - `/areas`, `/areas/:id` → Areas list/detail
      - `/resources`, `/resources/:id` → Resources list/detail
      - `/archive` → Archive
      - `/templates` → Templates
      - `/review` → Weekly Review
      - `/settings` → Settings
    - _Requirements: R9.1, R9.5; ui-guidelines.md §4_

  - [x] 0.14 Create AppShell layout component
    - Create `frontend/src/components/layout/AppShell.tsx`
    - Implement sidebar (232px at ≥1280px, 64px icon rail at 768-1279px)
    - Sidebar items: Dashboard, Inbox (with count pill), Projects, Areas, Resources, Archive, divider, Templates, Weekly review, Settings
    - Active item uses `aria-current="page"` with `--accent-soft` background
    - Implement header with search placeholder and Quick Capture button placeholder
    - Main content area with `max-width: 1240px`
    - _Requirements: R1.1, R9.5; ui-guidelines.md §4_

  - [x] 0.15 Configure API client with X-Calm-X header
    - Create `frontend/src/api/client.ts` with axios instance
    - Set `baseURL: '/api'` and `headers: { 'X-Calm-X': '1' }`
    - _Requirements: R15.3_

  - [x] 0.16 Configure TanStack Query client
    - Create `frontend/src/main.tsx` with QueryClientProvider
    - Configure QueryClient with sensible defaults
    - _Requirements: N/A (infrastructure)_

  - [x] 0.17 Configure sonner for toasts
    - Add `<Toaster />` to App component
    - Position bottom-right, minimum duration 3000ms
    - _Requirements: R15.6; ui-guidelines.md §2_

  - [x] 0.18 Create dev script to run both servers
    - Create script (npm script or shell script) that:
      - Starts backend with `python -m backend.main`
      - Starts frontend with `npm run dev` (or `pnpm dev`)
    - Document usage in README
    - _Requirements: N/A (developer experience)_

  - [x] 0.19 Create initial Alembic migration with COMPLETE schema
    - Create `migrations/versions/001_initial_schema.py` with ALL tables from design.md:
      - items (with all CHECK constraints for type enum, field lengths)
      - tasks (with foreign key to items, CHECK constraints)
      - subtasks (with foreign key to tasks)
      - tags (with COLLATE NOCASE for case-insensitive uniqueness)
      - task_tags (junction table with cascade delete)
      - reference_links (with foreign key to items)
      - resource_links (with foreign keys to items for both resource_id and linked_item_id)
      - templates
      - template_tasks (with foreign key to templates)
      - weekly_reviews
      - user_preferences (key-value store)
    - Create ALL indexes from design.md:
      - idx_items_type, idx_items_archived_at, idx_items_updated_at
      - idx_tasks_item_id, idx_tasks_due_date, idx_tasks_priority, idx_tasks_is_complete
      - idx_subtasks_task_id
      - idx_reference_links_item_id
      - idx_resource_links_resource_id, idx_resource_links_linked_item_id
      - idx_template_tasks_template_id
    - Insert default user_preferences row: `approaching_deadline_threshold = 3`
    - Verify migration runs without error
    - _Requirements: R13.1, R13.7, R16.2_

    **NOTE: Schema changes after initial deployment MUST use new migrations (002_…). NEVER edit migrations that have been applied to a database.**

- [x] 0.20 Checkpoint: Foundation complete
  - Verify both servers start without errors
  - Verify sidebar renders with all navigation items
  - Verify theme toggle works (light/dark/system)
  - Verify API client sends X-Calm-X header
  - Ensure all tests pass, ask the user if questions arise.

- [x] 1. Phase 1: Base Components
  - [x] 1.1 Create Button component
    - Variants: `primary` (accent fill), `secondary` (surface + border), `ghost` (transparent, accent text), `danger` (transparent, danger text)
    - Sizes: `default` (44px), `sm` (36px)
    - Icon-only buttons require `aria-label`
    - _Requirements: R15.7; ui-guidelines.md §5_

  - [x] 1.2 Create Card component
    - Surface background, 1px border, 12px radius, shadow, 20px padding
    - Clickable cards use `<Link>` not `div onClick`
    - _Requirements: ui-guidelines.md §5_

  - [x] 1.3 Create StatusBadge component
    - Props: `status: 'overdue' | 'approaching' | 'on-track'`, `date: string`
    - Pill shape, 24px high, icon + label + RelativeDate
    - Icons: AlertCircle (overdue), Clock (approaching), CheckCircle2 (on-track)
    - `aria-label`: "overdue", "approaching deadline", "on track"
    - Renders nothing for completed tasks
    - _Requirements: R4.2, R8.13, R8.14, R8.15, R9.4; ui-guidelines.md §5_

  - [x] 1.4 Create RelativeDate component
    - Renders `<time datetime="YYYY-MM-DD" title="Thu, 29 Oct 2026">In 3 days</time>`
    - Dotted underline style
    - Formatting rules per ui-guidelines.md §7:
      - 0 → "Today"
      - +1/-1 → "Tomorrow"/"Yesterday"
      - +2...+90 → "In N days"
      - -2...-90 → "N days ago"
      - Beyond ±90 → Absolute date (add year if not current)
    - _Requirements: R8.19; ui-guidelines.md §7_

  - [x] 1.5 Create ProgressBar component
    - `role="progressbar"`, `aria-valuenow/min/max`, `aria-label`
    - 6-8px height, `--track` background, `--accent` fill
    - Percentage label displayed next to bar
    - Uses shared `calculateProgress()` function
    - _Requirements: R4.3, R14.4; ui-guidelines.md §5_

  - [x] 1.6 Create EmptyState component
    - Short title, one sentence guidance, optional primary action button
    - Dashed border when replacing a list
    - _Requirements: R9.7, R12.10; ui-guidelines.md §5_

  - [x] 1.7 Create ConfirmDialog component
    - Based on shadcn AlertDialog
    - Used only for destructive/irreversible actions
    - Destructive button uses `danger` styling
    - Button text states the action (e.g., "Delete project")
    - _Requirements: R1.4, R7.10; ui-guidelines.md §5, §6_

  - [x] 1.8 Create Kbd component
    - Shortcut hint display, 12px font, bordered style
    - _Requirements: R15.10; ui-guidelines.md §5_

  - [x] 1.9 Create PriorityChip component
    - Neutral chip with `--surface-2` background
    - Text: "High", "Medium", or "Low"
    - Priority never uses status colors
    - _Requirements: R8.2; ui-guidelines.md §5_

  - [x] 1.10 Create TagChip component
    - Display: `#name`
    - `--surface-2` background, 4px radius, 12-13px font
    - _Requirements: R8.11; ui-guidelines.md §5_

  - [x] 1.11 Create Skeleton component
    - Loading placeholder that matches final layout
    - Shown after 200ms delay
    - _Requirements: R15.5; ui-guidelines.md §6_

  - [x] 1.12 Create date utilities in utils/date.ts
    - Implement `formatRelativeDate()` per ui-guidelines.md §7 rules
    - Implement `formatAbsoluteDate()` for tooltips
    - Implement `getLocalToday()` returning YYYY-MM-DD in client timezone
    - Use date-fns for date manipulation
    - _Requirements: R8.18, R8.19_

  - [x] 1.13 Create progress utilities in utils/progress.ts
    - Implement `calculateProgress(completed: number, total: number): number`
    - Use integer math formula: `(200 * completed + total) // (2 * total)` when total > 0, else 0
    - _Requirements: R4.3, R14.1_

  - [x] 1.14 Unit tests for all base components
    - Test Button variants and sizes render correctly
    - Test StatusBadge renders correct icon/color for each status
    - Test StatusBadge renders nothing when task is complete
    - Test RelativeDate formats dates correctly per §7 rules
    - Test ProgressBar displays correct percentage
    - Test Skeleton appears after 200ms delay
    - _Requirements: N/A (quality assurance)_

  - [x] 1.15 Unit test: calculateProgress(1, 8) returns 13
    - REGRESSION TEST: Verify 1/8 = 12.5% rounds to 13%
    - Test both utils/progress.ts (frontend) function
    - _Requirements: R4.3, R14.1_

- [x] 1.16 Checkpoint: Base components complete
  - Create a test page or Storybook showing all components
  - Verify all components render correctly in light and dark themes
  - Verify accessibility (focus states, aria attributes)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 2. Phase 2: Items (Projects, Areas, Resources)
  - [x] 2.1 Create SQLAlchemy ORM models for Items
    - Create `backend/models/item.py` with `Item` model
    - Fields: id, type (project/area/resource), title, description, notes, archived_at, created_at, updated_at
    - Project fields: project_goal, project_deadline, project_status, project_completed_at
    - Area fields: area_maintenance_notes
    - Configure relationships with cascade="all, delete-orphan" and passive_deletes=True
    - Use UTCDateTime for all timestamp columns
    - _Requirements: R1.3, R4.1, R5.1, R6.1_

  - [x] 2.2 Create Pydantic schemas for Items
    - Create `backend/schemas/item.py` with ItemBase, ItemCreate, ItemUpdate
    - Create type-specific response schemas: ProjectResponse, AreaResponse, ResourceResponse
    - Include computed fields: task_count, completed_task_count, progress_percentage
    - Implement field validators for title stripping
    - _Requirements: Field Constraints table_

  - [x] 2.3 Implement ArchivedItemGuard
    - Create `backend/services/guards.py`
    - Implement `guard_not_archived(item: Item)` that raises ArchivedItemError if archived
    - Implement `guard_task_item_not_archived(session, task: Task)` for task operations
    - _Requirements: R7.1, R7.2_

  - [x] 2.4 Implement ItemService
    - Create `backend/services/item_service.py`
    - Implement `create_item()` with type-specific field handling
    - Implement `update_item()` with archived guard
    - Implement `delete_item()` WITHOUT archived guard (deletion always allowed per R7.9)
    - Implement `get_item()` and `list_items()` with filters
    - _Requirements: R1.2, R1.3, R1.4, R4.1, R5.1, R6.1, R7.9_

  - [x] 2.5 Implement archive and restore operations in ItemService
    - Implement `archive_item()` to set archived_at timestamp
    - Implement `restore_item()` to clear archived_at timestamp
    - _Requirements: R5.6, R6.7, R7.1, R7.6_

  - [x] 2.6 Implement project completion operations in ItemService
    - Implement `complete_project()` to set status="completed" and project_completed_at
    - Implement `reopen_project()` to set status="active" and clear project_completed_at
    - _Requirements: R4.10, R4.11_

  - [x] 2.7 Create Items API router
    - Create `backend/api/items.py`
    - GET `/api/items` - List items with type and archived filters
    - GET `/api/items/{id}` - Get item details
    - POST `/api/items` - Create new item
    - PUT `/api/items/{id}` - Update item
    - DELETE `/api/items/{id}` - Delete item (active or archived)
    - POST `/api/items/{id}/archive` - Archive item
    - POST `/api/items/{id}/restore` - Restore archived item
    - POST `/api/items/{id}/complete` - Mark project completed
    - POST `/api/items/{id}/reopen` - Reopen project
    - _Requirements: R1.1, R1.2, R1.3, R1.4, R7.1, R7.6, R7.9, R4.10, R4.11_

  - [x] 2.8 Create TypeScript interfaces for Items
    - Create `frontend/src/types/models.ts`
    - Define Project, Area, Resource interfaces with discriminated union Item type
    - Define ItemType, ProjectStatus enums
    - _Requirements: N/A (type safety)_

  - [x] 2.9 Create Item API hooks
    - Create `frontend/src/hooks/useItems.ts`
    - Implement useItems(), useItem(), useCreateItem(), useUpdateItem(), useDeleteItem()
    - Implement useArchiveItem(), useRestoreItem(), useCompleteProject(), useReopenProject()
    - _Requirements: N/A (data fetching)_

  - [x] 2.10 Create NewItemDialog component
    - Create dialog for creating new Items
    - Type selection required (Project, Area, Resource radio buttons)
    - When Project selected, show "Start from template" option (disabled placeholder until Phase 8)
    - Title field required
    - Optional fields based on type: description, notes, goal/deadline (Project), maintenance_notes (Area)
    - Validation errors inline
    - _Requirements: R1.2; ui-guidelines.md §5_

  - [x] 2.11 Create ItemListView component
    - Create `frontend/src/pages/Projects.tsx`, `Areas.tsx`, `Resources.tsx`
    - Display list of items as cards
    - Include progress bar for Projects
    - Link each card to detail view
    - Empty state when no items
    - _Requirements: R1.1, R4.3; ui-guidelines.md §4, §5_

  - [x] 2.12 Create ItemDetailView component
    - Create `frontend/src/pages/ProjectDetail.tsx`, `AreaDetail.tsx`, `ResourceDetail.tsx`
    - Display item header with title, description
    - Project: show deadline with StatusBadge, goal, progress card
    - Area: show maintenance notes
    - Resource: show reference links placeholder
    - Include Notes section
    - _Requirements: R4.1, R4.2, R5.1, R6.1; ui-guidelines.md §4_

  - [x] 2.13 Implement inline editing in ItemDetailView
    - Inline edit for title (click to edit, Enter to save, Escape to cancel)
    - Inline edit for description, notes (textarea)
    - Inline edit for type-specific fields: goal, deadline (date picker), maintenance_notes
    - Validation errors appear under the field
    - _Requirements: ui-guidelines.md §6_

  - [x] 2.14 Implement "Ready for completion" banner for Projects
    - Display success banner when all tasks complete AND at least one task exists
    - Include "Complete project" action button
    - _Requirements: R4.7; ui-guidelines.md §6_

  - [x] 2.15 Implement "Mark complete" / "Reopen" actions
    - Add "Mark project complete" button that calls complete endpoint
    - On completion, prompt "Archive this project?" (Yes archives, No keeps active with completed status)
    - Add "Reopen project" button for completed projects
    - _Requirements: R1.6, R4.10, R4.11; ui-guidelines.md §6_

  - [x] 2.16 Implement item actions menu (⋯)
    - Add dropdown menu with: Convert type, Archive, Delete
    - Convert type opens TypeConversionDialog (placeholder for Phase 5)
    - Archive calls archive endpoint
    - Delete shows ConfirmDialog before deletion
    - _Requirements: R1.4, R1.5, R7.1_

  - [x] 2.17 Implement Archive banner for read-only items
    - When viewing archived item, show "Read-only · Archived on {date}" banner
    - Include Restore and Delete buttons
    - Disable all editing controls (inputs, buttons) but keep data visible
    - _Requirements: R7.2, R7.7; ui-guidelines.md §6_

  - [x] 2.18 Property test: Archived Items Are Read-Only (P10)
    - **Property 10: Archived Items Are Read-Only (Except Deletion)**
    - Test that update operations on archived items raise ArchivedItemError
    - Test that delete operations on archived items succeed
    - **Validates: Requirements R7.1, R7.2, R7.9**

  - [x] 2.19 Property test: Resource Link Cleanup on Item Deletion (P23)
    - **Property 23: Resource Link Cleanup on Item Deletion**
    - Test that deleting an Item removes all entries from resource_links where the Item was either resource_id or linked_item_id
    - **Validates: Requirements R2.9**

  - [x] 2.20 REGRESSION TEST: Deleting a Project deletes its tasks (Inbox unchanged)
    - Create project with tasks
    - Record Inbox task count
    - Delete project
    - Verify tasks are deleted (not moved to Inbox)
    - Verify Inbox count unchanged
    - _Requirements: R1.4_

- [x] 2.21 Checkpoint: Items complete
  - Create, view, edit, archive, restore, and delete Projects, Areas, Resources in browser
  - Verify archive banner appears for archived items with controls disabled
  - Verify delete confirmation dialog appears
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Phase 3: Tasks & Subtasks
  - [x] 3.1 Create SQLAlchemy ORM models for Tasks and Subtasks
    - Create `backend/models/task.py` with Task model
    - Fields: id, item_id (nullable for Inbox), title, description, notes, due_date, priority, is_complete, sort_order, created_at, updated_at
    - Create Subtask model: id, task_id, title, is_complete, sort_order, created_at, updated_at
    - Configure relationships with cascade delete
    - _Requirements: R3.1, R8.1, R8.3_

  - [x] 3.2 Create SQLAlchemy ORM models for Tags and TaskTags
    - Create `backend/models/tag.py` with Tag model (case-insensitive name via COLLATE NOCASE)
    - Create TaskTag junction table model
    - _Requirements: R12.1, R12.2_

  - [x] 3.3 Create SQLAlchemy ORM model for UserPreference
    - Create `backend/models/preference.py` with UserPreference model
    - Fields: key (PK), value, updated_at
    - _Requirements: R16.4_

  - [x] 3.4 Create Pydantic schemas for Tasks and Subtasks
    - Create `backend/schemas/task.py` with TaskCreate, TaskUpdate, TaskResponse
    - Create SubtaskCreate, SubtaskResponse
    - Include validation for 20 tag limit per task
    - _Requirements: Field Constraints table, R8.11_

  - [x] 3.5 Implement ProgressService
    - Create `backend/services/progress_service.py`
    - Implement `calculate_progress(completed, total)` using integer math: `(200*m + n) // (2*n)`
    - Implement `calculate_project_progress(project_id)`
    - Implement `calculate_task_progress(task_id)`
    - _Requirements: R4.3, R8.5, R14.1, R14.2, R14.3_

  - [x] 3.6 Implement TimestampService
    - Create `backend/services/timestamp_service.py`
    - Implement `now_utc()` helper
    - Implement `update_item_timestamp(session, item_id)`
    - Implement `update_task_timestamp(session, task_id)` - updates task and propagates to parent
    - Implement `on_task_move(session, task, old_item_id, new_item_id)`
    - _Requirements: R13.2_

  - [x] 3.7 Implement UserPreferenceService (read-only)
    - Create `backend/services/preference_service.py`
    - Implement `get_preferences()` - all preferences as dict
    - Implement `get_threshold()` - returns approaching_deadline_threshold as int
    - _Requirements: R16.1, R16.2_

  - [x] 3.8 Implement TagService
    - Create `backend/services/tag_service.py`
    - Implement `create_tag()` with case-insensitive uniqueness check
    - Implement `rename_tag()` with uniqueness validation
    - Implement `delete_tag()` (cascade removes from all tasks)
    - Implement `list_tags()`
    - _Requirements: R12.1, R12.2, R12.4_

  - [x] 3.9 Create Tags API router
    - Create `backend/api/tags.py`
    - GET `/api/tags` - List all tags
    - POST `/api/tags` - Create tag
    - PUT `/api/tags/{id}` - Rename tag
    - DELETE `/api/tags/{id}` - Delete tag
    - _Requirements: R12.1, R12.4_

  - [-] 3.10 Create Settings API router (read-only)
    - Create `backend/api/settings.py`
    - GET `/api/settings` - Get all preferences
    - _Requirements: R16.1_

  - [x] 3.11 Implement TaskService
    - Create `backend/services/task_service.py`
    - Implement `create_task()` with 100 task limit check on target item
    - Implement `update_task()` with archived guard
    - Implement `delete_task()` with archived guard (unlike delete_item)
    - Implement `get_task()`, `list_tasks()`, `get_inbox_tasks()`
    - _Requirements: R3.1, R8.1, R4.5, R4.6, R5.4, R5.5_

  - [x] 3.12 Implement task movement in TaskService
    - Implement `move_task(task_id, target_item_id)` with:
      - 100 task limit check on target
      - Block movement to archived items with error message
      - Timestamp propagation to old and new parents
    - _Requirements: R3.4, R3.5, R3.8_

  - [x] 3.13 Implement task completion with subtask cascade
    - Implement `mark_complete(task_id)` that auto-completes all subtasks within 100ms
    - Implement `mark_incomplete(task_id)` that marks all subtasks incomplete within 100ms
    - _Requirements: R8.8, R8.9, R8.16_

  - [x] 3.14 Implement task reordering
    - Implement `reorder_tasks(item_id, task_ids)` to update sort_order
    - _Requirements: R4.9, R5.7_

  - [x] 3.15 Implement SubtaskService
    - Create `backend/services/subtask_service.py`
    - Implement `create_subtask()` with 100 subtask limit, auto-incomplete parent if complete (R8.10)
    - Implement `update_subtask()` with archived guard
    - Implement `delete_subtask()` with archived guard, re-evaluate parent status after deletion
    - _Requirements: R8.3, R8.4, R8.10_

  - [x] 3.16 Implement subtask completion synchronization
    - Implement `mark_complete(subtask_id)` - auto-complete parent task if ALL subtasks complete
    - Implement `mark_incomplete(subtask_id)` - mark parent task incomplete
    - _Requirements: R8.4, R8.6, R8.7_

  - [x] 3.17 Create Tasks API router
    - Create `backend/api/tasks.py`
    - GET `/api/tasks` - List tasks with filters
    - GET `/api/tasks/inbox` - Get inbox tasks
    - GET `/api/items/{id}/tasks` - Get tasks for an item
    - POST `/api/tasks` - Create task
    - POST `/api/tasks/quick-capture` - Quick capture to inbox
    - PUT `/api/tasks/{id}` - Update task
    - DELETE `/api/tasks/{id}` - Delete task
    - POST `/api/tasks/{id}/move` - Move task
    - POST `/api/tasks/{id}/complete` - Mark complete
    - POST `/api/tasks/{id}/incomplete` - Mark incomplete
    - PUT `/api/items/{id}/tasks/reorder` - Reorder tasks
    - _Requirements: R3.1, R3.2, R3.3, R3.4, R3.5, R4.5, R4.9, R8.1, R8.8, R8.9, R8.16_

  - [x] 3.18 Create Subtasks API router
    - Create `backend/api/subtasks.py`
    - GET `/api/tasks/{id}/subtasks`
    - POST `/api/tasks/{id}/subtasks`
    - PUT `/api/subtasks/{id}`
    - DELETE `/api/subtasks/{id}`
    - POST `/api/subtasks/{id}/complete`
    - POST `/api/subtasks/{id}/incomplete`
    - _Requirements: R8.3, R8.4, R8.6, R8.7_

  - [x] 3.19 Create TypeScript interfaces for Tasks and Subtasks
    - Add Task, Subtask, Tag interfaces to models.ts
    - Define Priority enum
    - Implement `getDeadlineStatus(dueDate, isComplete, threshold, localToday)` utility
    - Fetch threshold from GET /api/settings for getDeadlineStatus() utility
    - _Requirements: R8.13, R8.14, R8.15_

  - [x] 3.20 Create Task API hooks
    - Create `frontend/src/hooks/useTasks.ts`
    - Implement useTasks(), useTask(), useInboxTasks()
    - Implement useCreateTask(), useUpdateTask(), useDeleteTask()
    - Implement useMoveTask(), useCompleteTask(), useIncompleteTask()
    - Implement useReorderTasks()
    - Implement optimistic updates with rollback on error
    - _Requirements: ui-guidelines.md §6_

  - [x] 3.21 Create Subtask API hooks
    - Implement useSubtasks(), useCreateSubtask(), useUpdateSubtask(), useDeleteSubtask()
    - Implement useCompleteSubtask(), useIncompleteSubtask()
    - _Requirements: N/A (data fetching)_

  - [x] 3.22 Create Tag API hooks
    - Implement useTags(), useCreateTag(), useRenameTag(), useDeleteTag()
    - _Requirements: N/A (data fetching)_

  - [x] 3.23 Create TaskRow component
    - Drag handle (button with `aria-label="Reorder {title}"`)
    - Checkbox with `aria-label="Mark complete: {title}"`
    - Title button that opens drawer
    - Meta line: priority chip, subtask count (e.g., "2/4"), tag chips
    - StatusBadge on right for due date
    - Min height 52px, selected row uses `--accent-soft`
    - Completed rows: muted text, line-through
    - _Requirements: R8.1, R8.5, R8.13, R8.14, R8.15; ui-guidelines.md §5_

  - [x] 3.24 Create TaskList component with drag-and-drop
    - List of TaskRow components
    - Use @dnd-kit/sortable for reordering
    - Configure BOTH pointer AND keyboard sensors
    - Keyboard: focus handle, Space to lift, arrows to move, Space to drop, Escape to cancel
    - Announce moves to screen readers
    - Completed tasks grouped under collapsible "Show N completed"
    - _Requirements: R4.9, R5.7; ui-guidelines.md §6_

  - [x] 3.25 Create TaskDrawer component
    - Opens via `?task=:taskId` URL parameter (survives refresh, Back closes)
    - Width 360-460px, overlay sheet below 1280px
    - Header: checkbox + title (inline editable)
    - Details: Project/Area name, Priority (select), Due date (date picker with RelativeDate), Tags (combobox)
    - Subtasks section: progress bar + checklist + "Add subtask" input
    - Description section (textarea)
    - Footer: "Move to…" combobox, "Delete task" button
    - Escape closes and returns focus to row
    - _Requirements: R8.1, R8.3, R8.4, R8.11; ui-guidelines.md §5_

  - [x] 3.26 Implement "Move to…" combobox in TaskDrawer
    - List non-archived Projects and Areas plus Inbox option
    - On selection, call move endpoint
    - _Requirements: R3.4, R3.5_

  - [x] 3.27 Implement Tag combobox in TaskDrawer
    - Display assigned tags
    - Allow adding/removing tags (max 20)
    - Allow creating new tags inline
    - _Requirements: R8.11, R12.1_

  - [x] 3.28 Implement subtask sync UI with confirmation prompt
    - When unchecking a completed task that has subtasks, show confirmation: "Reset all subtasks to incomplete?"
    - "Yes" calls /incomplete endpoint
    - "No" keeps task complete (cancel action)
    - R8.6-R8.10 synchronization reflected immediately in UI
    - _Requirements: R8.9; ui-guidelines.md §6_

  - [x] 3.29 Implement optimistic updates with rollback
    - Checkbox toggles update UI immediately
    - Use TanStack Query onMutate to snapshot and update optimistically
    - On error, rollback from snapshot and show error toast
    - _Requirements: R13.8; ui-guidelines.md §6_

  - [x] 3.30 Add Tasks section to Item detail views
    - Display TaskList on Project and Area detail pages
    - Include "Add task" button (disabled with message at 100 tasks)
    - _Requirements: R4.5, R4.6, R5.4, R5.5_

  - [x] 3.31 Property test: Progress Calculation Consistency (P1)
    - **Property 1: Progress Calculation Consistency**
    - Test `(200*M + N) // (2*N)` for all M ≤ N
    - Test N=0 returns 0
    - **Validates: Requirements R4.3, R4.4, R14.1**

  - [x] 3.32 Property test: Task Completion Cascades to Subtasks (P2)
    - **Property 2: Task Completion Cascades to Subtasks**
    - Mark task complete, verify all subtasks complete within 100ms
    - **Validates: Requirements R8.8**

  - [x] 3.33 Property test: Task Incompletion Cascades to Subtasks (P3)
    - **Property 3: Task Incompletion Cascades to Subtasks**
    - Mark task incomplete, verify all subtasks incomplete within 100ms
    - **Validates: Requirements R8.9**

  - [x] 3.34 Property test: All Subtasks Complete Triggers Task Completion (P4)
    - **Property 4: All Subtasks Complete Triggers Task Completion**
    - Complete all subtasks, verify parent task complete within 100ms
    - **Validates: Requirements R8.6**

  - [x] 3.35 Property test: Subtask Incompletion Propagates to Task (P5)
    - **Property 5: Subtask Incompletion Propagates to Task**
    - Mark any subtask incomplete, verify parent task incomplete within 100ms
    - **Validates: Requirements R8.7**

  - [x] 3.36 Property test: Adding Subtask to Complete Task (P6)
    - **Property 6: Adding Subtask to Complete Task Makes Task Incomplete**
    - Add subtask to complete task, verify task becomes incomplete within 100ms
    - **Validates: Requirements R8.10**

  - [x] 3.37 Property test: Task Ownership Exclusivity (P14)
    - **Property 14: Task Ownership Exclusivity**
    - Test that a Task is owned by exactly one of: Inbox (item_id = NULL), a Project, or an Area
    - Test that a Task can never belong to a Resource
    - **Validates: Requirements R3.7**

  - [-] 3.38 Property test: Deadline Status Badge Correctness Frontend (P15)
    - **Property 15: Deadline Status Badge Correctness (Frontend)**
    - For any Task/Project with due date, using local date:
      - "overdue" if due_date < localToday AND not complete
      - "approaching" if due_date within threshold days from localToday
      - "on-track" if due_date beyond threshold days
    - **Validates: Requirements R4.2, R8.13, R8.14, R8.15**

  - [x] 3.39 Property test: Task Maximum Per Item Enforced (P21)
    - **Property 21: Task Maximum Per Item Enforced**
    - Test that creating task 101 on a Project/Area raises LimitExceededError
    - Test that moving task to item with 100 tasks raises LimitExceededError
    - **Validates: Requirements R4.5, R4.6, R5.4, R5.5**

  - [x] 3.40 REGRESSION TEST: /incomplete endpoint persists is_complete=false
    - Create task with subtasks, all complete
    - Call POST /tasks/{id}/incomplete
    - Reload from database
    - Verify task.is_complete is False
    - Verify all subtask.is_complete are False
    - _Requirements: R8.9_

  - [-] 3.41 Unit test: Backend calculateProgress(1, 8) returns 13
    - REGRESSION TEST: Verify 1/8 = 12.5% rounds to 13%
    - Test backend progress_service.calculate_progress()
    - _Requirements: R4.3, R14.1_

- [x] 3.42 Checkpoint: Tasks & Subtasks complete
  - Create, edit, delete tasks and subtasks in browser
  - Verify task-subtask completion synchronization works correctly
  - Verify drag-and-drop reordering works with keyboard
  - Verify task drawer opens via URL parameter
  - Verify "Show N completed" grouping
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Phase 4: Inbox & Quick Capture + Dashboard
  - [x] 4.1 Create InboxView page
    - Display all tasks with item_id = null
    - Include Quick Capture form pinned at top
    - Display task count in header
    - Empty state: "Inbox zero. Everything has a home."
    - _Requirements: R3.1, R3.6; ui-guidelines.md §10_

  - [x] 4.2 Implement Quick Capture form
    - Single title input field
    - Enter saves to Inbox with Medium priority
    - Show toast "Added to Inbox" with link
    - _Requirements: R3.2, R3.3_

  - [x] 4.3 Add "Move to…" button on each Inbox task row
    - Combobox listing non-archived Projects and Areas
    - Support bulk-select checkbox for moving multiple tasks
    - _Requirements: R3.4, R3.5_

  - [x] 4.4 Create Quick Capture global dialog
    - Opens with Q shortcut from any page
    - Same behavior as inline form
    - Modal dialog that focuses input
    - _Requirements: R3.2; ui-guidelines.md §8_

  - [x] 4.5 Implement useShortcuts hook
    - Ignore events from input, textarea, select elements
    - Support Q, /, Ctrl+K, ?, Escape shortcuts
    - _Requirements: R15.10; ui-guidelines.md §8_

  - [x] 4.6 Create DashboardService
    - Create `backend/services/dashboard_service.py`
    - Implement `get_dashboard_data(client_today: date)` accepting client's local date
    - Calculate: inbox_count, active_projects_count, active_task_count, areas_count, area_task_count, resources_count, reference_link_count, archives_count
    - Calculate overall_progress for eligible active projects (exclude archived, completed, zero-task)
    - Get upcoming_deadlines within threshold (overdue + approaching ONLY)
    - Get last_review_date
    - _Requirements: R9.1, R9.2, R9.3, R9.4, R14.5_

  - [x] 4.7 Create Dashboard API router
    - Create `backend/api/dashboard.py`
    - GET `/api/dashboard?today=YYYY-MM-DD` - Get dashboard data
    - Use client's local date for deadline calculations
    - _Requirements: R9.1, R9.2, R9.3, R9.4_

  - [x] 4.8 Create Dashboard page
    - Display six summary cards in 3-column grid (2 columns below 1280px)
    - Cards: Inbox, Projects, Areas, Resources, Archives, Overall progress
    - All five PARA/Inbox cards visible without scrolling at 1280×800
    - _Requirements: R1.1, R3.6, R9.1, R9.2; ui-guidelines.md §4_

  - [x] 4.9 Implement Dashboard summary cards
    - Inbox: task count, "Process inbox →" link
    - Projects: active count, open task count, nearest deadline
    - Areas: count, open task count
    - Resources: count, reference link count
    - Archives: archived item count
    - Overall progress: average percentage with progress bar
    - _Requirements: R9.2, R14.5_

  - [x] 4.10 Implement "Needs attention" section
    - Display overdue items first (red badges), sorted oldest first
    - Then approaching items (yellow badges), sorted soonest first
    - Include both tasks and projects with deadlines
    - Empty state: "Nothing overdue or due soon."
    - _Requirements: R9.3, R9.4_

  - [x] 4.11 Implement "Active projects" section
    - Show each active project with progress bar and deadline badge
    - Projects without deadline show "No deadline"
    - _Requirements: R9.2_

  - [x] 4.12 Add "Start weekly review" button
    - Display in Dashboard header
    - Show "Last weekly review X days ago" or "No reviews yet"
    - _Requirements: R10.1, R10.13_

  - [x] 4.13 Update Sidebar with Inbox count pill
    - Show task count next to Inbox nav item
    - At 768-1279px (collapsed rail), show count as dot/pill
    - _Requirements: R3.6; ui-guidelines.md §4_

  - [x] 4.14 Property test: Dashboard Progress Excludes Ineligible Projects (P13)
    - **Property 13: Dashboard Progress Excludes Ineligible Projects**
    - Test that archived projects are excluded from overall progress
    - Test that completed projects are excluded from overall progress
    - Test that zero-task projects are excluded from overall progress
    - **Validates: Requirements R14.5**

  - [x] 4.15 REGRESSION TEST: Overdue items appear in Dashboard "Needs attention"
    - Create task with due_date in the past
    - Call GET /api/dashboard?today={today}
    - Verify task appears in upcoming_deadlines with is_overdue=true
    - _Requirements: R9.3, R9.4_

- [x] 4.16 Checkpoint: Inbox & Dashboard complete
  - Quick Capture works from any page (Q shortcut)
  - Dashboard displays correct counts and calculations
  - "Needs attention" shows overdue and approaching items correctly
  - Inbox shows tasks with move functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Phase 5: Type Conversion & Links
  - [x] 5.1 Implement TypeConversionService
    - Create `backend/services/type_conversion_service.py`
    - Implement `convert(item_id, payload: TypeConversionPayload)` handling all 6 paths:
      - Project → Area: hide deadline/goal/status, keep tasks
      - Project → Resource: hide deadline/goal/status, move tasks to Inbox
      - Area → Project: restore/set deadline/goal, keep tasks
      - Area → Resource: hide maintenance_notes, move tasks to Inbox
      - Resource → Project: restore/set deadline/goal
      - Resource → Area: restore/set maintenance_notes
    - Delete resource_links when converting FROM Resource (R2.7)
    - Delete resource_links when converting TO Resource (R2.8)
    - _Requirements: R1.5, R2.1, R2.2, R2.3, R2.4, R2.5, R2.6, R2.7, R2.8_

  - [x] 5.2 Add convert endpoint to Items API
    - POST `/api/items/{id}/convert` with TypeConversionPayload
    - _Requirements: R1.5_

  - [x] 5.3 Create TypeConversionDialog component
    - Show current type and target type dropdown
    - Display consequences before confirming:
      - "X open tasks will move to the Inbox"
      - "Links to Y resources will be removed"
    - Optional fields for deadline/goal when converting to Project
    - Optional field for maintenance_notes when converting to Area
    - _Requirements: R2.2, R2.4, R2.7, R2.8; ui-guidelines.md §5_

  - [x] 5.4 Create SQLAlchemy models for ReferenceLink and ResourceLink
    - ReferenceLink: id, item_id, url, sort_order, created_at
    - ResourceLink: id, resource_id, linked_item_id, created_at (unique constraint)
    - _Requirements: R6.3, R6.4_

  - [x] 5.5 Create Pydantic schemas for links
    - ReferenceLinkCreate with URL validation (http/https, max 2000 chars)
    - ReferenceLinkResponse, ResourceLinkResponse
    - _Requirements: Field Constraints table_

  - [x] 5.6 Implement ReferenceLinkService
    - Implement `add_reference_link()` with URL validation and 50 link limit
    - Implement `remove_reference_link()`, `reorder_links()`
    - _Requirements: R6.3_

  - [x] 5.7 Implement ResourceLinkService
    - Implement `link_resource()` with 20 link limit
    - Block linking to archived items or Resources
    - Implement `unlink_resource()`
    - _Requirements: R6.4, R6.5, R6.6_

  - [x] 5.8 Create Links API routers
    - GET/POST `/api/items/{id}/links` - Reference links
    - DELETE `/api/links/{id}` - Remove reference link
    - GET `/api/resources/{id}/linked-items`
    - POST `/api/resources/{id}/link`
    - DELETE `/api/resources/{id}/link/{item_id}`
    - _Requirements: R6.3, R6.4_

  - [x] 5.9 Create Reference Links UI
    - Display reference links in Item detail view
    - Add link form with URL validation
    - Remove link button
    - Drag-and-drop reordering
    - _Requirements: R6.3_

  - [x] 5.10 Create Resource Links UI
    - Display linked Projects/Areas in Resource detail view
    - "Link to…" combobox listing non-archived Projects and Areas
    - Unlink button for each linked item
    - _Requirements: R6.4_

  - [x] 5.11 Property test: Type Conversion Preserves Common Data (P7)
    - **Property 7: Type Conversion Preserves Common Data**
    - Test that title, description, notes, reference links remain unchanged after type conversion
    - **Validates: Requirements R2.1, R2.2, R2.3, R2.4, R2.5, R2.6**

  - [x] 5.12 Property test: Type Conversion Hides but Preserves Fields (P8)
    - **Property 8: Type Conversion Hides but Preserves Type-Specific Fields**
    - Test that converting Project to Area hides project_deadline, project_goal but preserves in DB
    - Test that converting Area to Resource hides maintenance_notes but preserves in DB
    - **Validates: Requirements R2.1, R2.2, R2.4**

  - [x] 5.13 Property test: Tasks Move to Inbox on Resource Conversion (P9)
    - **Property 9: Tasks Move to Inbox on Resource Conversion**
    - Test that converting Project/Area to Resource moves all tasks to Inbox (item_id = NULL)
    - **Validates: Requirements R2.2, R2.4**

  - [x] 5.14 Property test: Reference Link Maximum Enforced (P19)
    - **Property 19: Reference Link Maximum Enforced**
    - Test that adding link 51 to an Item raises LimitExceededError
    - **Validates: Requirements R6.3**

  - [x] 5.15 Property test: Resource Link Maximum Enforced (P20)
    - **Property 20: Resource Link Maximum Enforced**
    - Test that linking resource to item 21 raises LimitExceededError
    - **Validates: Requirements R6.4**

  - [x] 5.16 Property test: Resource Link Cleanup on Type Conversion (P22)
    - **Property 22: Resource Link Cleanup on Type Conversion**
    - Test FROM Resource: resource_links where resource_id matches are deleted
    - Test TO Resource: resource_links where linked_item_id matches are deleted
    - **Validates: Requirements R2.7, R2.8**

- [x] 5.17 Checkpoint: Type Conversion complete
  - Convert items between all type combinations in browser
  - Verify tasks move to Inbox when converting to Resource
  - Verify resource links are cleaned up appropriately
  - Verify reference links and resource links CRUD works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Phase 6: Filters, Search, Shortcuts
  - [x] 6.1 Create Tag management UI in Settings
    - Add "Tags" section to Settings page (/settings)
    - List all tags with rename and delete actions
    - Create new tag form
    - _Requirements: R12.1_

  - [x] 6.2 Implement filter query builder for tasks
    - Support filtering by tag IDs (OR logic within tags)
    - Support filtering by priority levels (OR logic within priorities)
    - Support filtering by due date range (start and/or end)
    - Support filtering by category (project/area/inbox) and item_id
    - Combine all filter types with AND logic
    - Exclude archived items from results
    - _Requirements: R12.5, R12.6, R12.7, R12.8, R12.9_

  - [x] 6.3 Add filter parameters to GET /api/tasks
    - Query params: tags, priorities, due_start, due_end, category, item_id, include_archived
    - _Requirements: R12.5, R12.6, R12.7, R12.8, R12.9_

  - [x] 6.4 Create FilterPanel component
    - Tag multi-select (OR logic)
    - Priority multi-select (OR logic)
    - Due date range picker
    - Category dropdown
    - "Clear filters" button
    - _Requirements: R12.5, R12.6, R12.7, R12.8_

  - [x] 6.5 Display filter results
    - Show filtered tasks across categories or within specific category
    - Empty state when no matches: "No matching tasks found"
    - _Requirements: R12.9, R12.10_

  - [x] 6.6 Implement SearchService
    - Create `backend/services/search_service.py`
    - Implement `search(query, include_archived=True)` with LIKE query
    - Escape SQL wildcards (%, _, \)
    - Search titles and descriptions of Items and Tasks
    - Include "(Archived)" label for archived items
    - Limit to 100 results
    - _Requirements: R9.6, R9.7_

  - [x] 6.7 Create Search API router
    - GET `/api/search?q={query}` - Global search
    - _Requirements: R9.6, R9.7_

  - [x] 6.8 Create Command Palette using cmdk
    - Open with Ctrl/⌘+K or / (focus search)
    - Groups: Navigation, Actions, Search results
    - Actions: New project, Quick capture, Start weekly review
    - Search results grouped by Projects, Areas, Resources, Tasks
    - Archived items show "(Archived)" label
    - _Requirements: R9.6, R9.7; ui-guidelines.md §2, §4_

  - [x] 6.9 Create Shortcut Help dialog
    - Opens with ? shortcut
    - List all shortcuts from ui-guidelines.md §8
    - _Requirements: R15.10; ui-guidelines.md §8_

  - [x] 6.10 Wire up all shortcuts
    - Q → Quick capture dialog
    - / → Focus search (command palette)
    - Ctrl/⌘+K → Command palette
    - ? → Shortcut help
    - Escape → Close overlays
    - _Requirements: R15.10_

  - [x] 6.11 Property test: Tag Filter Uses OR Logic (P11)
    - **Property 11: Tag Filter Uses OR Logic**
    - Filter by [T1, T2], verify tasks with T1 OR T2 are included
    - **Validates: Requirements R12.5**

  - [x] 6.12 Property test: Combined Filters Use AND Logic (P12)
    - **Property 12: Combined Filters Use AND Logic**
    - Combine tags + priority + due date, verify AND across filter types
    - **Validates: Requirements R12.8**

- [x] 6.13 Checkpoint: Filters, Search, Shortcuts complete
  - Create, rename, delete tags in Settings
  - Filter tasks by tags, priority, due date - verify OR/AND logic
  - Search items and tasks via command palette
  - All keyboard shortcuts work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Phase 7: Archive View
  - [x] 7.1 Create ArchiveView page
    - Display all items with archived_at != null
    - Display archive date using RelativeDate (with absolute date on hover)
    - Sort by archive date, newest first
    - _Requirements: R7.3, R7.7_

  - [x] 7.2 Implement archive search
    - Search bar for title and description
    - _Requirements: R7.4_

  - [x] 7.3 Implement archive filters
    - Filter by type (Project, Area, Resource)
    - Filter by archive date range
    - _Requirements: R7.5_

  - [x] 7.4 Implement Restore action
    - "Restore" button on each archived item
    - Calls restore endpoint, removes from archive view
    - _Requirements: R7.6_

  - [x] 7.5 Implement Delete action with confirmation
    - "Delete" button on each archived item
    - Shows ConfirmDialog with message: "This item will be permanently deleted. This action cannot be undone."
    - _Requirements: R7.9, R7.10_

- [x] 7.6 Checkpoint: Archive View complete
  - View archived items with search and filters
  - Restore items from archive
  - Permanently delete items with confirmation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Phase 8: Templates
  - [x] 8.1 Create SQLAlchemy models for Templates
    - Template: id, title, description, created_at, updated_at
    - TemplateTask: id, template_id, title, description, priority, relative_days (0-365), sort_order
    - _Requirements: R11.1, R11.2_

  - [x] 8.2 Create Pydantic schemas for Templates
    - TemplateCreate, TemplateUpdate, TemplateResponse
    - TemplateTaskCreate, TemplateTaskResponse
    - Validate 50 task limit per template
    - _Requirements: Field Constraints table, R11.1_

  - [x] 8.3 Implement TemplateService
    - Create `backend/services/template_service.py`
    - Implement `create_template()`, `update_template()`, `delete_template()`
    - Implement `get_template()`, `list_templates()`
    - Validate 50 task limit
    - _Requirements: R11.1, R11.2, R11.5_

  - [x] 8.4 Implement create project from template
    - Implement `create_project_from_template(template_id, title, start_date, project_goal, project_deadline)`
    - Copy template data to new project
    - Calculate actual due dates: start_date + relative_days
    - Default start_date to today if not provided
    - _Requirements: R11.3, R11.4_

  - [x] 8.5 Create Templates API router
    - Create `backend/api/templates.py`
    - GET `/api/templates` - List templates
    - GET `/api/templates/{id}` - Get template with tasks
    - POST `/api/templates` - Create template
    - PUT `/api/templates/{id}` - Update template
    - DELETE `/api/templates/{id}` - Delete template
    - POST `/api/templates/{id}/create-project` - Create project from template
    - _Requirements: R11.1, R11.3, R11.4_

  - [x] 8.6 Create Templates page
    - List of templates (title, description, task count)
    - Create, edit, delete templates
    - _Requirements: R11.1_

  - [x] 8.7 Create Template editor
    - Title and description fields
    - Task list with: title, description, priority, relative day offset (0-365)
    - Drag-and-drop task reordering
    - Add/remove tasks (max 50)
    - _Requirements: R11.1, R11.2_

  - [x] 8.8 Implement "Create from template" flow
    - On "New project", offer "Start from template" or "Blank project"
    - Template selection with preview
    - Editable title (prefilled from template)
    - Start date picker (default today)
    - Live preview of calculated due dates
    - Validation errors inline with data retained
    - _Requirements: R11.3, R11.4, R11.5_

  - [x] 8.9 Enable "Start from template" in NewItemDialog
    - Enable the previously disabled template option in NewItemDialog (task 2.10)
    - When user selects Project type, enable template selection
    - _Requirements: R11.4_

- [x] 8.10 Checkpoint: Templates complete
  - Create, edit, delete templates
  - Create project from template with correct due dates
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Phase 9: Weekly Review
- [x] 9.1 Create SQLAlchemy model for WeeklyReview
    - WeeklyReview: id, completed_at, notes
    - _Requirements: R10.10, R10.11_

  - [x] 9.2 Create Pydantic schemas for WeeklyReview
    - WeeklyReviewComplete, WeeklyReviewResponse
    - _Requirements: Field Constraints table_

  - [x] 9.3 Implement WeeklyReviewService
    - Create `backend/services/review_service.py`
    - Implement `start_review()` - begin review session
    - Implement `get_inbox_tasks()` - tasks for inbox step
    - Implement `get_projects_for_review()` - active projects with task counts, days since update
    - Implement `get_areas_for_review()` - areas with task counts
    - Implement `get_resources_for_review()` - resources sorted by least recently updated
    - Implement `get_stale_items(days=30)` - items with no updates for 30+ days
    - Implement `complete_review(notes)` - record review with timestamp
    - _Requirements: R10.1, R10.2, R10.3, R10.4, R10.5, R10.6, R10.7, R10.8, R10.10, R10.11_

  - [ ] 9.4 Create Weekly Review API router
    - Create `backend/api/review.py`
    - GET `/api/weekly-review/status` - Get last review date
    - POST `/api/weekly-review/start` - Start review
    - GET `/api/weekly-review/inbox` - Inbox tasks
    - GET `/api/weekly-review/projects` - Projects for review
    - GET `/api/weekly-review/areas` - Areas for review
    - GET `/api/weekly-review/resources` - Resources for review
    - GET `/api/weekly-review/stale-items` - Items with no updates 30+ days
    - POST `/api/weekly-review/complete` - Complete review
    - GET `/api/weekly-review/history` - Past reviews
    - _Requirements: R10.1, R10.3, R10.4, R10.5, R10.6, R10.7, R10.8, R10.10, R10.13_

  - [ ] 9.5 Create Weekly Review page with focused layout
    - No sidebar, full-width layout
    - Top bar: "Weekly review · Started today", "Changes save as you go.", "Exit review" button
    - Stepper showing 5 steps: Inbox, Projects, Areas, Resources, Summary
    - Back/Next navigation in sticky footer
    - _Requirements: R10.1, R10.2; ui-guidelines.md §4_

  - [ ] 9.6 Implement Inbox review step
    - Show one task at a time with "Task n of N" progress
    - Actions per task: Move to project (select), Move to area (select), Mark complete, Delete, Skip
    - _Requirements: R10.3_

  - [ ] 9.7 Implement Projects review step
    - Show one project at a time with done/total tasks, progress bar, "Updated X days ago"
    - Per task actions: Keep, Update due date, Complete, Delete
    - Per project actions: Mark complete, Archive
    - Show stale banner for projects with no updates 30+ days
    - _Requirements: R10.4, R10.5, R10.8_

  - [ ] 9.8 Implement Areas review step
    - Show all areas with open task count, next task, overdue badge
    - "Looks good" toggle per area
    - "+ Add task" button
    - _Requirements: R10.6_

  - [ ] 9.9 Implement Resources review step
    - Show resources sorted by least recently updated
    - Stale resources (30+ days) flagged "Suggest archiving"
    - Actions: Keep, Update, Archive
    - _Requirements: R10.7, R10.8_

  - [ ] 9.10 Implement Summary step
    - Show counts of actions performed during review
    - Notes textarea (max 500 chars with live counter)
    - "Complete review" button
    - _Requirements: R10.10, R10.11_

  - [ ] 9.11 Implement immediate save for all review actions
    - Every action (complete, update, delete) saves to database within 100ms
    - "Exit review" returns to Dashboard without recording review (R10.12)
    - Header states "Changes save as you go."
    - _Requirements: R10.9, R10.12_

  - [ ] 9.12 Implement review completion
    - Record completed_at timestamp and notes
    - Show confirmation with date
    - Link back to Dashboard
    - Dashboard shows "Last weekly review today"
    - _Requirements: R10.10, R10.11, R10.13_

  - [ ] 9.13 Property test: Weekly Review Action Persistence (P16)
    - **Property 16: Weekly Review Action Persistence**
    - Test that actions performed during Weekly Review are persisted immediately
    - Test that exiting without completing still preserves task changes
    - **Validates: Requirements R10.9, R10.12**

- [ ] 9.14 Checkpoint: Weekly Review complete
  - Complete full weekly review flow through all 5 steps
  - Verify actions save immediately
  - Verify "Exit review" discards review record but keeps action changes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Phase 10: Settings, Backup, Import/Export
  - [ ] 10.1 Implement UserPreferenceService (update operations)
    - Extend preference_service.py with `update_preferences(prefs)`
    - Validate approaching_deadline_threshold (1-30)
    - Support theme preference (system/light/dark)
    - _Requirements: R16.2, R16.3, R16.4, R16.5_

  - [ ] 10.2 Add PUT to Settings API router
    - PUT `/api/settings` - Update preferences
    - _Requirements: R16.2, R16.3_

  - [ ] 10.3 Implement BackupService
    - Create `backend/services/backup_service.py`
    - Implement `create_backup(trigger)` using `VACUUM INTO` (safe SQLite copy)
    - Filename pattern: `calmx_backup_YYYYMMDD_HHMMSS_mmm.db`
    - Implement `list_backups()` by reading filenames from backup directory
    - Implement `check_startup_backup()` - create if last > 24 hours
    - Implement `cleanup_old_backups()` - keep 7 most recent
    - _Requirements: R13.6_

  - [ ] 10.4 Create Backup API router
    - Create `backend/api/backup.py`
    - GET `/api/backup/list` - List backups
    - POST `/api/backup/create` - Create manual backup
    - _Requirements: R13.6_

  - [ ] 10.5 Implement export functionality
    - Create `backend/services/import_export_service.py`
    - Implement `export_data()` returning JSON with schema_version and all tables
    - Tables: items, tasks, subtasks, tags, task_tags, reference_links, resource_links, templates, template_tasks, weekly_reviews, user_preferences
    - _Requirements: R13.4_

  - [ ] 10.6 Implement import with validation
    - Implement `import_data(data, mode)` with mode: merge/replace
    - Validate JSON structure with Pydantic (ImportValidationError on failure)
    - Validate internal FK references before any modification
    - Merge mode: generate new IDs, merge tags by name (case-insensitive)
    - Replace mode: create backup first, then delete all existing data
    - Rollback transaction on any error (ImportFailedError)
    - _Requirements: R13.5_

  - [ ] 10.7 Create Import/Export API router
    - GET `/api/export` - Export all data as JSON
    - POST `/api/import` - Import data with mode parameter
    - _Requirements: R13.4, R13.5_

  - [ ] 10.8 Create Settings page
    - Theme preference: System, Light, Dark radio buttons
    - Apply theme immediately on change
    - Persist to backend UserPreference table
    - _Requirements: R16.5; ui-guidelines.md §3_

  - [ ] 10.9 Implement threshold setting UI
    - Number input for approaching_deadline_threshold (1-30)
    - Live preview: "Tasks due within X days are marked as due soon"
    - Apply within 100ms of change
    - _Requirements: R16.2, R16.3_

  - [ ] 10.10 Implement Data section in Settings
    - "Export JSON" button - downloads file
    - "Import JSON" with file picker and mode choice (Merge/Replace)
    - Replace mode: show confirmation with backup note
    - Display file summary before confirming import
    - _Requirements: R13.4, R13.5_

  - [ ] 10.11 Implement Backup list in Settings
    - Display backups with dates and sizes
    - "Create backup now" button
    - _Requirements: R13.6_

  - [ ] 10.12 Update ThemeProvider to use backend preference
    - On load, fetch theme from GET /api/settings
    - On change, persist to PUT /api/settings
    - Fall back to localStorage if API unavailable
    - _Requirements: R16.5_

  - [ ] 10.13 Property test: Backup Retention Policy (P17)
    - **Property 17: Backup Retention Policy**
    - After backup operation, verify ≤7 backup files exist
    - Oldest files removed first
    - **Validates: Requirements R13.6**

  - [ ] 10.14 Property test: Import Merge Generates New IDs (P18)
    - **Property 18: Import Merge Generates New IDs**
    - Import data in merge mode, verify all records get new IDs
    - No conflicts with existing records
    - **Validates: Requirements R13.5**

  - [ ] 10.15 Property test: UTCDateTime Round-Trip Consistency (P24)
    - **Property 24: UTCDateTime Round-Trip Consistency**
    - Store datetime, reload, verify timezone-aware with tzinfo=timezone.utc
    - Same instant in time preserved
    - **Validates: Requirements R13.1**

  - [ ] 10.16 Property test: CSRF Protection Enforced (P25)
    - **Property 25: CSRF Protection Enforced**
    - Non-GET request without X-Calm-X: 1 header returns 403
    - **Validates: Requirements R15.3**

- [ ] 10.17 Checkpoint: Settings, Backup, Import/Export complete
  - Change theme and threshold settings, verify persistence
  - Create and list backups
  - Export data to JSON, import with merge and replace modes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Phase 11: Polish & Accessibility
  - [ ] 11.1 Implement focus trap for dialogs and drawers
    - Tab cycles within dialog/drawer when open
    - Focus returns to trigger element when closed
    - _Requirements: R15.7; ui-guidelines.md §6_

  - [ ] 11.2 Implement focus management after deletion
    - After deleting a row, move focus to next row
    - _Requirements: ui-guidelines.md §6_

  - [ ] 11.3 Verify contrast in both themes
    - Body text ≥ 4.5:1 contrast ratio
    - Large text and UI boundaries ≥ 3:1
    - Verify all status colors meet requirements
    - _Requirements: ui-guidelines.md §9_

  - [ ] 11.4 Verify accessible elements
    - All interactive elements use semantic HTML (button, a, input with label)
    - No div onClick patterns
    - Icon-only buttons have aria-label
    - Decorative icons have aria-hidden="true"
    - _Requirements: R15.7; ui-guidelines.md §9_

  - [ ] 11.5 Verify landmarks
    - `<nav aria-label="Main">` for sidebar
    - `<header>` for app header
    - `<main>` for content area
    - `<aside aria-label="Task details">` for drawer
    - _Requirements: ui-guidelines.md §9_

  - [ ] 11.6 Implement responsive 768-1279px layout
    - Sidebar collapses to 64px icon rail
    - Nav items become icon-only with tooltips on hover/focus
    - Inbox count stays visible as pill
    - Dashboard cards in 2 columns
    - Task drawer overlays content from right (sheet mode)
    - _Requirements: R15.4; ui-guidelines.md §4_

  - [ ] 11.7 Verify touch targets
    - Minimum 36px for all interactive elements
    - 44px for primary actions and nav items
    - _Requirements: ui-guidelines.md §9_

  - [ ] 11.8 REGRESSION TEST: SPA fallback serves static files correctly
    - Request /favicon.ico, verify file served
    - Request /manifest.json, verify file served
    - Request /nonexistent-route, verify index.html served
    - Request /api/nonexistent, verify 404 JSON response
    - _Requirements: R15.1_

  - [ ] 11.9 Create README.md
    - Project description
    - Prerequisites (Python 3.11+, Node.js 18+)
    - Setup instructions (install dependencies, run migrations)
    - Development: how to run both servers
    - Production: how to build frontend and run backend
    - Environment variables documentation
    - _Requirements: N/A (documentation)_

  - [ ] 11.10 Final integration tests
    - End-to-end flow: create project, add tasks, complete tasks, complete project, archive
    - Test all property tests pass
    - Test all regression tests pass
    - _Requirements: N/A (quality assurance)_

- [ ] 11.11 Checkpoint: Final - Application complete
  - Manual accessibility audit with keyboard navigation
  - Test responsive layout at 768px, 1024px, 1280px+ widths
  - Verify all features work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Property tests P1-P6, P7-P10, P13-P16, P17-P25 are NOT optional and must be implemented
- Regression tests for cascade delete, /incomplete persistence, 1/8 progress, dashboard overdue, and SPA fallback must be implemented
- delete_task() and delete_subtask() MUST use archived guard; only delete_item() bypasses it (R7.9)
- Theme preference (system/light/dark) must be persisted in backend UserPreference table
- Each phase ends with a runnable application and checkpoint for verification
- All frontend components must follow ui-guidelines.md design tokens and patterns
- Use `calculateProgress()` utility everywhere - never inline the formula
- Schema changes after initial deployment MUST use new migrations (002_…). NEVER edit migrations that have been applied to a database.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0.1", "0.2"] },
    { "id": 1, "tasks": ["0.3", "0.9"] },
    { "id": 2, "tasks": ["0.4", "0.5", "0.6", "0.10"] },
    { "id": 3, "tasks": ["0.7", "0.11", "0.12"] },
    { "id": 4, "tasks": ["0.8", "0.13", "0.14"] },
    { "id": 5, "tasks": ["0.15", "0.16", "0.17"] },
    { "id": 6, "tasks": ["0.18", "0.19"] },
    { "id": 7, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 8, "tasks": ["1.6", "1.7", "1.8", "1.9", "1.10", "1.11"] },
    { "id": 9, "tasks": ["1.12", "1.13"] },
    { "id": 10, "tasks": ["1.14", "1.15"] },
    { "id": 11, "tasks": ["2.1", "2.2"] },
    { "id": 12, "tasks": ["2.3", "2.4"] },
    { "id": 13, "tasks": ["2.5", "2.6"] },
    { "id": 14, "tasks": ["2.7"] },
    { "id": 15, "tasks": ["2.8", "2.9"] },
    { "id": 16, "tasks": ["2.10", "2.11"] },
    { "id": 17, "tasks": ["2.12", "2.13"] },
    { "id": 18, "tasks": ["2.14", "2.15", "2.16"] },
    { "id": 19, "tasks": ["2.17", "2.18", "2.19", "2.20"] },
    { "id": 20, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 21, "tasks": ["3.4", "3.5"] },
    { "id": 22, "tasks": ["3.6", "3.7", "3.8"] },
    { "id": 23, "tasks": ["3.9", "3.10"] },
    { "id": 24, "tasks": ["3.11", "3.12"] },
    { "id": 25, "tasks": ["3.13", "3.14"] },
    { "id": 26, "tasks": ["3.15", "3.16"] },
    { "id": 27, "tasks": ["3.17", "3.18"] },
    { "id": 28, "tasks": ["3.19", "3.20", "3.21", "3.22"] },
    { "id": 29, "tasks": ["3.23", "3.24"] },
    { "id": 30, "tasks": ["3.25", "3.26", "3.27"] },
    { "id": 31, "tasks": ["3.28", "3.29", "3.30"] },
    { "id": 32, "tasks": ["3.31", "3.32", "3.33", "3.34", "3.35", "3.36", "3.37", "3.38", "3.39", "3.40", "3.41"] },
    { "id": 33, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 34, "tasks": ["4.4", "4.5"] },
    { "id": 35, "tasks": ["4.6", "4.7"] },
    { "id": 36, "tasks": ["4.8", "4.9", "4.10"] },
    { "id": 37, "tasks": ["4.11", "4.12", "4.13", "4.14", "4.15"] },
    { "id": 38, "tasks": ["5.1", "5.2"] },
    { "id": 39, "tasks": ["5.3", "5.4", "5.5"] },
    { "id": 40, "tasks": ["5.6", "5.7"] },
    { "id": 41, "tasks": ["5.8", "5.9", "5.10"] },
    { "id": 42, "tasks": ["5.11", "5.12", "5.13", "5.14", "5.15", "5.16"] },
    { "id": 43, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 44, "tasks": ["6.4", "6.5"] },
    { "id": 45, "tasks": ["6.6", "6.7"] },
    { "id": 46, "tasks": ["6.8", "6.9", "6.10"] },
    { "id": 47, "tasks": ["6.11", "6.12"] },
    { "id": 48, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 49, "tasks": ["7.4", "7.5"] },
    { "id": 50, "tasks": ["8.1", "8.2"] },
    { "id": 51, "tasks": ["8.3", "8.4"] },
    { "id": 52, "tasks": ["8.5"] },
    { "id": 53, "tasks": ["8.6", "8.7"] },
    { "id": 54, "tasks": ["8.8", "8.9"] },
    { "id": 55, "tasks": ["9.1", "9.2"] },
    { "id": 56, "tasks": ["9.3", "9.4"] },
    { "id": 57, "tasks": ["9.5"] },
    { "id": 58, "tasks": ["9.6", "9.7", "9.8", "9.9"] },
    { "id": 59, "tasks": ["9.10", "9.11", "9.12", "9.13"] },
    { "id": 60, "tasks": ["10.1", "10.2"] },
    { "id": 61, "tasks": ["10.3", "10.4"] },
    { "id": 62, "tasks": ["10.5", "10.6"] },
    { "id": 63, "tasks": ["10.7"] },
    { "id": 64, "tasks": ["10.8", "10.9", "10.10", "10.11"] },
    { "id": 65, "tasks": ["10.12"] },
    { "id": 66, "tasks": ["10.13", "10.14", "10.15", "10.16"] },
    { "id": 67, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5"] },
    { "id": 68, "tasks": ["11.6", "11.7"] },
    { "id": 69, "tasks": ["11.8", "11.9"] },
    { "id": 70, "tasks": ["11.10"] }
  ]
}
```

