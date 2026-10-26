# Requirements Document

## Introduction

Calm-X is a local task management web application built on the PARA Method (Projects, Areas, Resources, Archives) from Tiago Forte's Second Brain methodology. The application helps users achieve mental clarity by organizing tasks according to actionability rather than broad subjects. It runs locally via localhost (127.0.0.1) with SQLite storage, providing a private, offline-capable productivity system.

Items are organized by type (Project, Area, or Resource) with an optional archived status. An Inbox serves as a capture point for tasks that haven't yet been assigned to a Project or Area. The application supports the CODE workflow (Capture, Organize, Distill, Express) through quick task capture to Inbox and subsequent organization into PARA categories.

All Items share common fields (description, notes, reference links) while type-specific fields (Project: deadline, goal; Area: maintenance_notes) are hidden but preserved when converting between types. Archived Items become read-only and are excluded from active views but remain searchable.

## Glossary

- **Calm_X_App**: The main web application running on localhost that provides task management using the PARA Method
- **Task**: A single actionable item owned by exactly one Project, one Area, or the Inbox
- **Subtask**: A smaller task nested within a parent Task, forming a checklist
- **Project**: A short-term effort with a specific goal and deadline, containing related Tasks; has a status of "active" or "completed"
- **Project_Status**: The state of a Project, either "active" (in progress) or "completed" (finished)
- **completed_at**: Timestamp indicating when a Project was marked as completed; null for active Projects
- **Area**: An ongoing responsibility without an end date, representing a sphere of activity to maintain over time
- **Resource**: A topic of interest being learned or collected for future reference; contains notes and reference links but NOT Tasks
- **Archive**: A filtered view showing items with archived status; not a separate category
- **archived_at**: Timestamp indicating when an Item was archived; null for active items
- **Read_Only_Mode**: The state of archived Items where all data is preserved but editing and modification are prohibited; archived Items may be permanently deleted from the Archive view
- **updated_at**: Timestamp of last modification to an Item or any of its children (Tasks, Subtasks, notes)
- **Inbox**: A holding area for Tasks that have not yet been assigned to a Project or Area
- **Item**: A generic term for any entry with a type (Project, Area, or Resource)
- **Type_Conversion**: The process of changing an Item's type while preserving common data and hiding (not deleting) type-specific fields
- **Dashboard**: The main visual interface showing all PARA categories and Inbox contents
- **Weekly_Review**: A feature that guides users through assessing their Inbox, Projects, Areas, and Resources periodically
- **Template**: A predefined structure for creating new Projects with preset Tasks and properties
- **Tag**: A label that can be applied to Tasks for filtering and organization; names are case-insensitive
- **Priority_Level**: A ranking (High, Medium, Low) indicating Task urgency or importance
- **Progress_Tracker**: A component that calculates and displays completion percentage based on finished Tasks/Subtasks
- **SQLite_Database**: The local file-based database storing all application data
- **Approaching_Deadline_Threshold**: User-configurable number of days (default 3) used to identify items nearing their deadline

## Field Constraints

All text fields have the following length constraints. Individual requirements reference this table rather than specifying limits inline.

| Field | Min | Max | Notes |
|-------|-----|-----|-------|
| Item title (Project, Area, Resource) | 1 | 200 | Cannot be empty or whitespace-only |
| Description (all types) | 0 | 5000 | Optional; shared by all Item types |
| Notes (all types, Task) | 0 | 10000 | Optional; shared by all Item types and Tasks |
| Reference link | 1 | 2000 | Valid URL format; max 50 per Item (all types) |
| Project goal | 0 | 500 | Optional; Project-specific |
| Project deadline | - | - | Date only, no time component; Project-specific |
| Area maintenance notes | 0 | 1000 | Optional; Area-specific |
| Task title | 1 | 200 | Cannot be empty or whitespace-only |
| Subtask title | 1 | 200 | Cannot be empty or whitespace-only |
| Tag name | 1 | 50 | Case-insensitive uniqueness |
| Template title | 1 | 100 | Cannot be empty or whitespace-only |
| Template description | 0 | 500 | Optional |
| Weekly review notes | 0 | 500 | Optional |

## Out of Scope

The following features are NOT included in version 1:

- Multi-user support and collaboration
- Cloud sync and remote storage
- Push notifications and reminders
- File attachments
- Native mobile applications
- Recurring and repeating tasks
- Time tracking
- Calendar integration
- Email integration

## Requirements

### Requirement 1: PARA Category Management

**User Story:** As a user, I want to organize my work into Projects, Areas, and Resources with an Archive view for inactive items, so that I can focus on actionable items and maintain a clear mental model of my commitments.

#### Acceptance Criteria

1. THE Calm_X_App SHALL display a Dashboard showing Projects, Areas, Resources, Archives, and Inbox simultaneously visible in the same view without requiring navigation
2. WHEN a user creates a new Item, THE Calm_X_App SHALL require the user to assign it to exactly one type (Project, Area, or Resource) before the Item can be saved
3. THE Calm_X_App SHALL allow users to create, read, update, and delete Items, with validation according to the Field Constraints table
4. WHEN a user initiates deletion of an Item, THE Calm_X_App SHALL display a confirmation dialog before permanently removing the Item and all associated data (Tasks, Subtasks, notes)
5. WHEN a user moves an Item from one type to another, THE Calm_X_App SHALL apply the Type Conversion Rules defined in Requirement 2
6. WHEN a Project is marked as completed, THE Calm_X_App SHALL prompt the user to archive it; IF the user declines, THEN the Project SHALL remain active with completed status

### Requirement 2: Type Conversion Rules

**User Story:** As a user, I want to convert items between types (Project, Area, Resource), so that I can reorganize my work as priorities and circumstances change.

#### Acceptance Criteria

1. WHEN a Project is converted to an Area, THE Calm_X_App SHALL hide the deadline, goal, status, and completed_at fields (preserving them in the database) and retain all associated Tasks
2. WHEN a Project is converted to a Resource, THE Calm_X_App SHALL hide the deadline, goal, status, and completed_at fields (preserving them in the database) and move all associated Tasks to the Inbox
3. WHEN an Area is converted to a Project, THE Calm_X_App SHALL restore any previously hidden deadline and goal fields (or allow the user to set new values) and retain all associated Tasks
4. WHEN an Area is converted to a Resource, THE Calm_X_App SHALL hide the maintenance_notes field (preserving it in the database) and move all associated Tasks to the Inbox
5. WHEN a Resource is converted to a Project, THE Calm_X_App SHALL restore any previously hidden deadline and goal fields (or allow the user to set new values)
6. WHEN a Resource is converted to an Area, THE Calm_X_App SHALL restore any previously hidden maintenance_notes field (or allow the user to set a new value) and retain all notes and reference links
7. WHEN a Resource is converted to a Project or Area, THE Calm_X_App SHALL automatically remove all entries from resource_links where the Resource was the resource_id
8. WHEN a Project or Area is converted to a Resource, THE Calm_X_App SHALL automatically remove all entries from resource_links where the Item was the linked_item_id
9. WHEN an Item is deleted, THE Calm_X_App SHALL automatically remove all entries from resource_links where the Item was either the resource_id or the linked_item_id

### Requirement 3: Inbox and Quick Capture

**User Story:** As a user, I want an Inbox for capturing tasks quickly without immediately organizing them, so that I can collect thoughts rapidly and process them later.

#### Acceptance Criteria

1. THE Calm_X_App SHALL provide an Inbox that holds Tasks not assigned to any Project or Area
2. THE Calm_X_App SHALL provide a Quick Capture function accessible from any view that creates a Task directly in the Inbox
3. WHEN a user creates a Task via Quick Capture, THE Calm_X_App SHALL require only a title and set Priority_Level to Medium by default
4. THE Calm_X_App SHALL allow users to move a Task from the Inbox to exactly one non-archived Project or Area
5. THE Calm_X_App SHALL allow users to move a Task from a Project or Area back to the Inbox
6. THE Calm_X_App SHALL display the count of Tasks in the Inbox on the Dashboard
7. A Task SHALL be owned by exactly one of: Inbox, a Project, or an Area; Resources do not own Tasks
8. IF a user attempts to move a Task to an archived Project or Area, THEN THE Calm_X_App SHALL display an error message indicating that Tasks cannot be moved to archived Items

### Requirement 4: Project Management

**User Story:** As a user, I want to create and manage projects with specific goals and deadlines, so that I can track short-term efforts effectively.

#### Acceptance Criteria

1. WHEN a user creates a Project, THE Calm_X_App SHALL require a title, set status to "active" by default, and allow optional fields for description, notes, reference links, deadline, and goal statement, with validation according to the Field Constraints table
2. IF a Project has a deadline set, THEN THE Calm_X_App SHALL display the deadline date on the project view without requiring scrolling and display a color-coded status badge: red for overdue (due date before today), yellow for approaching (due date is today or within Approaching_Deadline_Threshold days in the future), green for on-track (due date beyond Approaching_Deadline_Threshold days)
3. WHILE a Project contains one or more Tasks, THE Calm_X_App SHALL calculate and display progress percentage as (completed Tasks / total Tasks) * 100, rounded to the nearest whole number
4. IF a Project contains zero Tasks, THEN THE Calm_X_App SHALL display progress as 0%
5. THE Calm_X_App SHALL allow users to associate up to 100 Tasks with a single Project
6. IF a user attempts to add a Task to a Project that already contains 100 Tasks, THEN THE Calm_X_App SHALL display an error message: "Maximum of 100 tasks per Project reached. Please complete or remove existing tasks."
7. WHEN all Tasks in a Project are completed AND the Project contains at least one Task, THE Calm_X_App SHALL display a status badge indicating the Project is ready for completion
8. IF a user attempts to create a Project with an invalid title, THEN THE Calm_X_App SHALL reject the creation and display an error message indicating the title requirements
9. THE Calm_X_App SHALL allow users to reorder Tasks within a Project via drag-and-drop, and persist the order in the SQLite_Database
10. THE Calm_X_App SHALL allow users to mark a Project as completed, which sets the status to "completed" and records the completed_at timestamp
11. THE Calm_X_App SHALL allow users to reopen a completed Project, which sets the status to "active" and clears the completed_at timestamp

### Requirement 5: Area Management

**User Story:** As a user, I want to define ongoing areas of responsibility, so that I can maintain standards in important life domains without pressure of deadlines.

#### Acceptance Criteria

1. WHEN a user creates an Area, THE Calm_X_App SHALL require a title and allow optional fields for description, notes, reference links, and maintenance notes, with validation according to the Field Constraints table
2. IF a user attempts to create an Area with an invalid title, THEN THE Calm_X_App SHALL reject the action and display an error message indicating the title requirements
3. THE Calm_X_App SHALL NOT require or display deadlines for Areas
4. THE Calm_X_App SHALL allow users to associate up to 100 Tasks with an Area
5. IF a user attempts to add a Task to an Area that already contains 100 Tasks, THEN THE Calm_X_App SHALL display an error message: "Maximum of 100 tasks per Area reached. Please complete or remove existing tasks."
6. WHEN a user chooses to archive an Area, THE Calm_X_App SHALL set the archived_at timestamp and preserve all associated data including Tasks and their completion status in Read_Only_Mode
7. THE Calm_X_App SHALL allow users to reorder Tasks within an Area via drag-and-drop, and persist the order in the SQLite_Database

### Requirement 6: Resource Management

**User Story:** As a user, I want to collect and organize resources on topics I'm learning, so that I can reference them when needed for active projects.

#### Acceptance Criteria

1. WHEN a user creates a Resource, THE Calm_X_App SHALL require a title and allow optional fields for description, notes, and reference links, with validation according to the Field Constraints table
2. IF a user attempts to create a Resource with an invalid title, THEN THE Calm_X_App SHALL reject the action and display an error message indicating the title requirements
3. THE Calm_X_App SHALL allow users to add, edit, and remove notes and reference links from a Resource
4. THE Calm_X_App SHALL allow users to link a Resource to up to 20 related non-archived Projects or Areas
5. IF a user attempts to link a Resource to a non-existent Project or Area, THEN THE Calm_X_App SHALL display an error message indicating the target item does not exist
6. IF a user attempts to link a Resource to an archived Project or Area, THEN THE Calm_X_App SHALL display an error message indicating that Resources cannot be linked to archived Items
7. WHEN a user selects the archive action for a Resource, THE Calm_X_App SHALL set the archived_at timestamp and preserve all associated data in Read_Only_Mode

### Requirement 7: Archive Management

**User Story:** As a user, I want to archive completed or inactive items, so that I can reference past work without cluttering my active workspace.

#### Acceptance Criteria

1. WHEN a user selects the archive action on a Project, Area, or Resource, THE Calm_X_App SHALL set the archived_at timestamp, preserve all original data intact (Tasks, notes, metadata), and set the Item to Read_Only_Mode
2. WHILE an Item is archived, THE Calm_X_App SHALL prevent all editing and modification of the Item and its associated Tasks and Subtasks
3. THE Calm_X_App SHALL provide an Archive view that displays all Items where archived_at is not null
4. THE Calm_X_App SHALL provide search functionality within Archives that searches Item titles and descriptions
5. THE Calm_X_App SHALL provide filter functionality within Archives by Item type (Project, Area, Resource) and archive date range
6. WHEN a user selects the restore action on an archived Item, THE Calm_X_App SHALL set archived_at to null, remove Read_Only_Mode, and return the Item to its original type view
7. THE Calm_X_App SHALL display the archive date for each archived Item using the user's locale date format
8. THE Calm_X_App SHALL exclude archived Items and their Tasks from Dashboard counts, filters, and deadline badges
9. THE Calm_X_App SHALL allow permanent deletion of archived Items from the Archive view
10. WHEN a user initiates deletion of an archived Item, THE Calm_X_App SHALL display a confirmation dialog with the message "This item will be permanently deleted. This action cannot be undone." before removing the Item and all associated data

### Requirement 8: Task Management

**User Story:** As a user, I want to create and manage detailed tasks with due dates, priorities, and subtasks, so that I can break down work into actionable steps.

#### Acceptance Criteria

1. WHEN a user creates a Task, THE Calm_X_App SHALL require a title and allow optional fields for description, due date (date only, no time component), Priority_Level, and Tags, with validation according to the Field Constraints table
2. THE Calm_X_App SHALL support three Priority_Levels: High, Medium, and Low, with Medium as the default when no priority is specified
3. THE Calm_X_App SHALL allow users to add up to 100 Subtasks per Task, with validation according to the Field Constraints table
4. THE Calm_X_App SHALL allow users to mark individual Subtasks as complete or incomplete, and to edit or delete existing Subtasks
5. WHEN Subtasks exist, THE Calm_X_App SHALL calculate and display Task completion percentage as the ratio of completed Subtasks to total Subtasks, rounded to the nearest whole number
6. WHEN all Subtasks of a Task are marked complete, THE Calm_X_App SHALL automatically mark the parent Task as complete within 100 milliseconds
7. WHEN any Subtask is marked incomplete, THE Calm_X_App SHALL automatically mark the parent Task as incomplete within 100 milliseconds
8. WHEN a Task is marked complete, THE Calm_X_App SHALL automatically mark all its Subtasks as complete within 100 milliseconds
9. WHEN a user marks a Task as incomplete via the API, THE Calm_X_App SHALL mark all Subtasks as incomplete within 100 milliseconds
10. WHEN a Subtask is added to a Task that is marked complete, THE Calm_X_App SHALL automatically mark the parent Task as incomplete within 100 milliseconds
11. THE Calm_X_App SHALL allow users to assign up to 20 Tags to a Task
12. THE Calm_X_App SHALL allow users to add notes to Tasks, with validation according to the Field Constraints table
13. WHEN a Task has a due date that is today or within Approaching_Deadline_Threshold days in the future AND is not marked complete, THE Calm_X_App SHALL display a yellow status badge with aria-label "approaching deadline"
14. WHEN a Task has a due date before today and is not marked complete, THE Calm_X_App SHALL display a red status badge with aria-label "overdue"
15. WHEN a Task has a due date beyond Approaching_Deadline_Threshold days in the future AND is not marked complete, THE Calm_X_App SHALL display a green status badge with aria-label "on track"
16. THE Calm_X_App SHALL allow users to mark a Task as complete or incomplete
17. IF a user attempts to create or save a Task with an invalid title, THEN THE Calm_X_App SHALL reject the action and display an error message indicating the title requirements
18. THE Calm_X_App SHALL store and display all due dates in the user's local timezone without time component
19. THE Calm_X_App SHALL display dates relative to the user's local date (e.g. 'In 3 days', 'Yesterday') and show the absolute date (e.g. 'Thu, 29 Oct 2026') on hover and focus

### Requirement 9: Dashboard and Navigation

**User Story:** As a user, I want a visual dashboard showing all PARA categories and Inbox, so that I can quickly understand my current commitments and priorities.

#### Acceptance Criteria

1. THE Calm_X_App SHALL display the Dashboard as the default landing page
2. THE Dashboard SHALL display summary cards for each category showing: Inbox Task count; active Projects count with active Task count and nearest deadline; Areas count with linked Task count; Resources count with reference link count; Archives count of all archived Items (counts exclude archived Items except for Archives)
3. THE Dashboard SHALL display upcoming deadlines within the Approaching_Deadline_Threshold days across all non-archived Projects
4. THE Dashboard SHALL display incomplete Tasks and Projects with status badges: red badge for overdue (due date before today), yellow badge for approaching deadline (due date is today or within Approaching_Deadline_Threshold days in the future), green badge for on-track (due date beyond Approaching_Deadline_Threshold days); completed Tasks SHALL NOT display deadline badges
5. THE Calm_X_App SHALL provide navigation to view detailed contents of each PARA category and the Inbox
6. THE Calm_X_App SHALL provide a global search function to find Items (Projects, Areas, Resources) and Tasks across all categories by title or description; archived Items SHALL be included in search results with "(Archived)" label appended to their title
7. IF a search returns no matching items, THEN THE Calm_X_App SHALL display a message indicating no results were found

### Requirement 10: Weekly Review

**User Story:** As a user, I want a guided weekly review feature, so that I can regularly assess my inbox, projects, areas, and resources to maintain system clarity.

#### Acceptance Criteria

1. THE Calm_X_App SHALL provide a Weekly_Review mode accessible from the Dashboard
2. WHEN Weekly_Review is started, THE Calm_X_App SHALL guide the user through steps in this order: Inbox, Projects, Areas, Resources, Summary
3. WHILE reviewing the Inbox, THE Calm_X_App SHALL present each Task and prompt the user to move it to a Project, move it to an Area, mark it complete, delete it, or skip it (keep in Inbox and move to next Task)
4. WHILE reviewing Projects, THE Calm_X_App SHALL present each active Project with its name, completed Task count out of total Tasks, and days since last update (based on updated_at)
5. WHILE reviewing Projects, THE Calm_X_App SHALL prompt the user to review each incomplete Task and select a next action: keep as-is, update due date, mark complete, or delete; additionally THE Calm_X_App SHALL provide quick actions to mark the Project as completed or archive the Project
6. WHILE reviewing Areas, THE Calm_X_App SHALL present each Area and prompt the user to review associated Tasks
7. WHILE reviewing Resources, THE Calm_X_App SHALL present each Resource and prompt the user to keep, update, or archive it
8. WHILE in Weekly_Review mode, THE Calm_X_App SHALL suggest archiving Projects and Resources that have had no updates for 30 or more days (based on updated_at)
9. WHEN a user performs an action on a Task during Weekly_Review (mark complete, update due date, delete), THE Calm_X_App SHALL save the change to the SQLite_Database within 100 milliseconds
10. WHEN Weekly_Review Summary step is reached, THE Calm_X_App SHALL allow the user to enter summary notes and save the review
11. WHEN Weekly_Review is completed, THE Calm_X_App SHALL record the review date and summary notes
12. IF the user exits Weekly_Review before completing the Summary step, THEN THE Calm_X_App SHALL discard only the review date and summary notes; all Task actions performed during the review remain saved
13. THE Calm_X_App SHALL display the date of the last completed Weekly_Review on the Dashboard

### Requirement 11: Project Templates

**User Story:** As a user, I want to create projects from templates, so that I can quickly set up recurring project types with predefined tasks.

#### Acceptance Criteria

1. THE Calm_X_App SHALL allow users to create, edit, and delete Templates, with validation according to the Field Constraints table, and up to 50 predefined Tasks per Template
2. WHEN creating a Template, THE Calm_X_App SHALL allow defining predefined Tasks with relative due dates specified as number of days (0 to 365) from the Project start date
3. WHEN a user creates a Project from a Template, THE Calm_X_App SHALL copy the Template title (editable before saving), description, and all predefined Tasks, calculating actual due dates by adding each Task's relative days to the user-provided Project start date (default: today)
4. WHEN a user initiates creation of a new Project, THE Calm_X_App SHALL provide an option to select a Template or proceed without a Template
5. IF a Template has invalid data (empty title or Tasks with invalid relative dates), THEN THE Calm_X_App SHALL display an error message and retain the entered data for correction

### Requirement 12: Tags and Filtering

**User Story:** As a user, I want to tag and filter my tasks, so that I can view related items across different projects and categories.

#### Acceptance Criteria

1. THE Calm_X_App SHALL allow users to create, rename, and delete Tags, with validation according to the Field Constraints table
2. THE Calm_X_App SHALL enforce case-insensitive uniqueness for Tag names, treating "Work" and "work" as the same Tag
3. THE Calm_X_App SHALL allow users to assign Tags to and remove Tags from Tasks
4. WHEN a Tag is deleted, THE Calm_X_App SHALL remove that Tag from all Tasks that had it assigned
5. THE Calm_X_App SHALL allow filtering Tasks by one or more Tags, where selecting multiple Tags returns Tasks matching ANY of the selected Tags (OR logic)
6. THE Calm_X_App SHALL allow filtering Tasks by one or more Priority_Levels
7. THE Calm_X_App SHALL allow filtering Tasks by due date range using start date, end date, or both
8. THE Calm_X_App SHALL allow combining multiple filter criteria (Tags, Priority, Due Date), where Tasks must match ALL filter types applied (AND logic)
9. THE Calm_X_App SHALL display filter results across all non-archived categories (including Inbox) or within a specific non-archived category selected by the user; archived Items and their Tasks are excluded from filter results
10. IF no Tasks match the applied filters, THEN THE Calm_X_App SHALL display a message indicating no matching Tasks were found

### Requirement 13: Data Persistence and Management

**User Story:** As a user, I want my data stored locally with backup and export capabilities, so that I have full control over my data and can use the app offline.

#### Acceptance Criteria

1. THE Calm_X_App SHALL store all data (Projects, Areas, Resources, Tasks, Tags, Templates, Weekly Reviews, and user preferences) in a local SQLite_Database file
2. WHEN user data is created or modified, THE Calm_X_App SHALL save changes to the SQLite_Database within 2 seconds
3. THE Calm_X_App SHALL provide all features offline without requiring internet connectivity
4. THE Calm_X_App SHALL provide an export function that saves all data to a JSON file
5. THE Calm_X_App SHALL provide an import function that loads data from a JSON file with options to merge with existing data or replace all existing data; WHEN merging, THE Calm_X_App SHALL generate new IDs for all imported records and merge Tags with the same name (case-insensitive) without creating duplicates; WHEN replacing, THE Calm_X_App SHALL create an automatic backup before replacing all data; IF the JSON file is invalid or has an incompatible schema version, THEN THE Calm_X_App SHALL reject the import without modifying existing data and display an error message
6. THE Calm_X_App SHALL automatically create a backup of the SQLite_Database file at application startup if the last backup is more than 24 hours old, and retain the 7 most recent backups
7. THE Calm_X_App SHALL support versioned schema migrations to handle database upgrades between application versions
8. IF a database write operation fails, THEN THE Calm_X_App SHALL display an error message indicating the failure reason and rollback the UI to the last saved state

### Requirement 14: Progress Tracking

**User Story:** As a user, I want to see progress metrics for my projects and tasks, so that I can understand how much work remains.

#### Acceptance Criteria

1. THE Progress_Tracker SHALL calculate Project completion as the percentage of completed Tasks within that Project, expressed as an integer from 0 to 100
2. IF a Task contains Subtasks, THEN THE Progress_Tracker SHALL calculate Task completion as the percentage of completed Subtasks within that Task, expressed as an integer from 0 to 100
3. IF a Task contains no Subtasks, THEN THE Progress_Tracker SHALL report 0% when the Task is incomplete and 100% when the Task is complete
4. THE Calm_X_App SHALL display progress as a progress bar with percentage label on Projects and Tasks
5. THE Dashboard SHALL display overall progress as the average completion percentage across all non-archived, active Projects that contain at least one Task; Projects with status "completed", Projects that are archived, and Projects with zero Tasks are excluded from the average calculation
6. WHEN a Task or Subtask status changes between complete and incomplete, THE Progress_Tracker SHALL recalculate the affected Project and Task percentages within 100 milliseconds

### Requirement 15: Web Application Interface

**User Story:** As a user, I want to access Calm-X through a web browser on localhost, so that I can use it on any device with a screen width of at least 768 pixels.

#### Acceptance Criteria

1. THE Calm_X_App SHALL run as a local web server bound to 127.0.0.1 on port 8080 by default
2. THE Calm_X_App SHALL allow the port to be configured via the CALM_X_PORT environment variable or the --port command-line argument
3. THE Calm_X_App SHALL operate as a single-user application without authentication
4. THE Calm_X_App SHALL provide a responsive web interface that adapts to screen widths with a minimum supported width of 768 pixels
5. WHEN a user action triggers processing, THE Calm_X_App SHALL display a loading indicator within 200 milliseconds
6. WHEN an action completes or fails, THE Calm_X_App SHALL display a success or error message for a minimum of 3 seconds
7. THE Calm_X_App SHALL support keyboard navigation using Tab key for focus movement and Enter key for activation on all interactive elements including buttons, links, and form fields
8. WHEN the user closes the browser, THE Calm_X_App SHALL preserve all data in the SQLite_Database
9. IF the configured port is unavailable at startup, THEN THE Calm_X_App SHALL display an error message indicating the port conflict and exit
10. THE Calm_X_App SHALL support these keyboard shortcuts when focus is not in an input field: Q (Quick capture), / (Focus search), Ctrl/⌘+K (Command palette), ? (Shortcut help), Escape (Close overlays)

### Requirement 16: User Preferences

**User Story:** As a user, I want to configure application settings, so that I can customize the experience to my workflow.

#### Acceptance Criteria

1. THE Calm_X_App SHALL provide a settings interface accessible from the Dashboard
2. THE Calm_X_App SHALL allow the user to configure the Approaching_Deadline_Threshold as a number of days from 1 to 30, with a default value of 3
3. WHEN the Approaching_Deadline_Threshold is changed, THE Calm_X_App SHALL apply the new threshold to all deadline-related displays within 100 milliseconds
4. THE Calm_X_App SHALL persist user preferences in the SQLite_Database
5. THE Calm_X_App SHALL allow the user to choose a theme (System, Light, Dark), apply it immediately, and persist it in the SQLite_Database
