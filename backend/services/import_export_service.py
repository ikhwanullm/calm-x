"""Import/Export service for Calm-X data (JSON format)."""
from __future__ import annotations

import logging
from datetime import date as _date, datetime, timezone
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from backend.exceptions import ImportFailedError, ImportValidationError
from backend.models.item import (
    Item, Task, Subtask, Tag, TaskTag, ReferenceLink, ResourceLink,
)
from backend.models.preference import UserPreference
from backend.models.template import Template, TemplateTask
from backend.models.weekly_review import WeeklyReview

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1
_EXPORT_MAX_BYTES = 10 * 1024 * 1024   # 10 MB hard limit for import payloads


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _dt_to_iso(dt: datetime | None) -> str | None:
    """Serialize a UTC-aware datetime to ISO 8601 UTC string."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"


def _iso_to_dt(s: str | None) -> datetime | None:
    """Parse an ISO 8601 string back to a UTC-aware datetime."""
    if not s:
        return None
    # Accept strings ending in "Z" or "+00:00"
    s = s.rstrip("Z")
    try:
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def export_data(session: Session) -> dict[str, Any]:
    """Serialize the full database to a JSON-serializable dict."""

    def item_dict(item: Item) -> dict:
        return {
            "id": item.id, "type": item.type, "title": item.title,
            "description": item.description, "notes": item.notes,
            "archived_at": _dt_to_iso(item.archived_at),
            "created_at": _dt_to_iso(item.created_at),
            "updated_at": _dt_to_iso(item.updated_at),
            "project_goal": item.project_goal,
            "project_deadline": str(item.project_deadline) if item.project_deadline else None,
            "project_status": item.project_status,
            "project_completed_at": _dt_to_iso(item.project_completed_at),
            "area_maintenance_notes": item.area_maintenance_notes,
            "area_id": item.area_id,
        }

    def task_dict(t: Task) -> dict:
        return {
            "id": t.id, "item_id": t.item_id, "title": t.title,
            "description": t.description, "notes": t.notes,
            "due_date": str(t.due_date) if t.due_date else None,
            "priority": t.priority, "is_complete": t.is_complete,
            "sort_order": t.sort_order,
            "created_at": _dt_to_iso(t.created_at), "updated_at": _dt_to_iso(t.updated_at),
            "focus_date": str(t.focus_date) if t.focus_date else None,
            "waiting_for": t.waiting_for,
            "waiting_since": _dt_to_iso(t.waiting_since),
            "defer_until": str(t.defer_until) if t.defer_until else None,
            "is_someday": t.is_someday,
        }

    def subtask_dict(s: Subtask) -> dict:
        return {
            "id": s.id, "task_id": s.task_id, "title": s.title,
            "is_complete": s.is_complete, "sort_order": s.sort_order,
            "created_at": _dt_to_iso(s.created_at), "updated_at": _dt_to_iso(s.updated_at),
        }

    def tag_dict(t: Tag) -> dict:
        return {"id": t.id, "name": t.name, "created_at": _dt_to_iso(t.created_at)}

    def task_tag_dict(tt: TaskTag) -> dict:
        return {"task_id": tt.task_id, "tag_id": tt.tag_id}

    def ref_link_dict(l: ReferenceLink) -> dict:
        return {
            "id": l.id, "item_id": l.item_id, "url": l.url,
            "sort_order": l.sort_order, "created_at": _dt_to_iso(l.created_at),
        }

    def res_link_dict(l: ResourceLink) -> dict:
        return {
            "id": l.id, "resource_id": l.resource_id,
            "linked_item_id": l.linked_item_id, "created_at": _dt_to_iso(l.created_at),
        }

    def template_dict(t: Template) -> dict:
        return {
            "id": t.id, "title": t.title, "description": t.description,
            "created_at": _dt_to_iso(t.created_at), "updated_at": _dt_to_iso(t.updated_at),
        }

    def template_task_dict(tt: TemplateTask) -> dict:
        return {
            "id": tt.id, "template_id": tt.template_id, "title": tt.title,
            "description": tt.description, "priority": tt.priority,
            "relative_days": tt.relative_days, "sort_order": tt.sort_order,
        }

    def review_dict(r: WeeklyReview) -> dict:
        return {
            "id": r.id, "completed_at": _dt_to_iso(r.completed_at), "notes": r.notes,
        }

    def pref_dict(p: UserPreference) -> dict:
        return {"key": p.key, "value": p.value, "updated_at": _dt_to_iso(p.updated_at)}

    return {
        "schema_version": SCHEMA_VERSION,
        "exported_at": _dt_to_iso(datetime.now(timezone.utc)),
        "items": [item_dict(i) for i in session.execute(select(Item)).scalars()],
        "tasks": [task_dict(t) for t in session.execute(select(Task)).scalars()],
        "subtasks": [subtask_dict(s) for s in session.execute(select(Subtask)).scalars()],
        "tags": [tag_dict(t) for t in session.execute(select(Tag)).scalars()],
        "task_tags": [task_tag_dict(tt) for tt in session.execute(select(TaskTag)).scalars()],
        "reference_links": [ref_link_dict(l) for l in session.execute(select(ReferenceLink)).scalars()],
        "resource_links": [res_link_dict(l) for l in session.execute(select(ResourceLink)).scalars()],
        "templates": [template_dict(t) for t in session.execute(select(Template)).scalars()],
        "template_tasks": [template_task_dict(tt) for tt in session.execute(select(TemplateTask)).scalars()],
        "weekly_reviews": [review_dict(r) for r in session.execute(select(WeeklyReview)).scalars()],
        "user_preferences": [pref_dict(p) for p in session.execute(select(UserPreference)).scalars()],
    }


# ---------------------------------------------------------------------------
# Import validation schemas (lightweight Pydantic-free approach)
# ---------------------------------------------------------------------------

_REQUIRED_TOP_KEYS = frozenset({
    "schema_version", "items", "tasks", "subtasks", "tags", "task_tags",
    "reference_links", "resource_links", "templates", "template_tasks",
    "weekly_reviews", "user_preferences",
})

_SUPPORTED_VERSIONS = frozenset({1})


def _require_list(data: dict, key: str) -> list:
    val = data.get(key)
    if not isinstance(val, list):
        raise ImportValidationError(f"'{key}' must be a list, got {type(val).__name__}")
    return val


def _require_int(obj: dict, field: str, context: str) -> int:
    v = obj.get(field)
    if not isinstance(v, (int, float)):
        raise ImportValidationError(f"{context}: '{field}' must be an integer, got {v!r}")
    return int(v)


def _require_str(obj: dict, field: str, context: str) -> str:
    v = obj.get(field)
    if not isinstance(v, str):
        raise ImportValidationError(f"{context}: '{field}' must be a string, got {v!r}")
    return v


def validate_export_data(data: Any) -> dict:
    """Validate the structure of an export payload.

    Returns the validated dict if OK; raises ImportValidationError on any problem.
    Does NOT check FK consistency (that is done in import_data).
    """
    if not isinstance(data, dict):
        raise ImportValidationError("Import data must be a JSON object")

    missing = _REQUIRED_TOP_KEYS - data.keys()
    if missing:
        raise ImportValidationError(f"Missing required fields: {sorted(missing)}")

    version = data.get("schema_version")
    if version not in _SUPPORTED_VERSIONS:
        raise ImportValidationError(
            f"Unsupported schema_version {version!r}. Supported: {sorted(_SUPPORTED_VERSIONS)}"
        )

    # Check each table is a list (we don't deep-validate every field here —
    # that happens in _validate_import_refs)
    for key in _REQUIRED_TOP_KEYS - {"schema_version"}:
        _require_list(data, key)

    # Per-record field validation
    _validate_record_fields(data)

    return data


_VALID_TYPES = frozenset({"project", "area", "resource"})
_VALID_PRIORITIES = frozenset({"high", "medium", "low"})
_VALID_PROJECT_STATUSES = frozenset({"active", "completed", None})


def _validate_record_fields(data: dict) -> None:
    """Validate field values on every record — length limits, enums, etc.

    This prevents CHECK constraint 500 errors during write and gives clear
    field-level 400 responses instead.
    """
    # ── Items ──────────────────────────────────────────────────────────────
    for r in data["items"]:
        ctx = f"items[id={r.get('id')}]"
        item_type = r.get("type")
        if item_type not in _VALID_TYPES:
            raise ImportValidationError(f"{ctx}: type must be one of {sorted(_VALID_TYPES)}, got {item_type!r}")
        title = r.get("title", "")
        if not isinstance(title, str) or not title.strip() or len(title) > 200:
            raise ImportValidationError(f"{ctx}: title must be a non-empty string ≤ 200 chars")
        if len(r.get("description", "")) > 5000:
            raise ImportValidationError(f"{ctx}: description must be ≤ 5000 chars")
        if len(r.get("notes", "")) > 10000:
            raise ImportValidationError(f"{ctx}: notes must be ≤ 10000 chars")
        if item_type == "project":
            goal = r.get("project_goal")
            if goal is not None and len(goal) > 500:
                raise ImportValidationError(f"{ctx}: project_goal must be ≤ 500 chars")
            status = r.get("project_status")
            if status is not None and status not in ("active", "completed"):
                raise ImportValidationError(f"{ctx}: project_status must be 'active' or 'completed'")
        if item_type == "area":
            notes = r.get("area_maintenance_notes")
            if notes is not None and len(notes) > 1000:
                raise ImportValidationError(f"{ctx}: area_maintenance_notes must be ≤ 1000 chars")

    # ── Tasks ──────────────────────────────────────────────────────────────
    for r in data["tasks"]:
        ctx = f"tasks[id={r.get('id')}]"
        title = r.get("title", "")
        if not isinstance(title, str) or not title.strip() or len(title) > 200:
            raise ImportValidationError(f"{ctx}: title must be a non-empty string ≤ 200 chars")
        priority = r.get("priority", "medium")
        if priority not in _VALID_PRIORITIES:
            raise ImportValidationError(f"{ctx}: priority must be one of {sorted(_VALID_PRIORITIES)}, got {priority!r}")
        if len(r.get("description", "")) > 5000:
            raise ImportValidationError(f"{ctx}: description must be ≤ 5000 chars")
        if len(r.get("notes", "")) > 10000:
            raise ImportValidationError(f"{ctx}: notes must be ≤ 10000 chars")
        waiting_for = r.get("waiting_for")
        if waiting_for is not None and (not isinstance(waiting_for, str) or len(waiting_for) > 200):
            raise ImportValidationError(f"{ctx}: waiting_for must be a string ≤ 200 chars")
        defer_until = r.get("defer_until")
        if defer_until is not None:
            try:
                _date.fromisoformat(defer_until)
            except (TypeError, ValueError):
                raise ImportValidationError(f"{ctx}: defer_until must be a YYYY-MM-DD date")

    # ── Subtasks ───────────────────────────────────────────────────────────
    for r in data["subtasks"]:
        ctx = f"subtasks[id={r.get('id')}]"
        title = r.get("title", "")
        if not isinstance(title, str) or not title.strip() or len(title) > 200:
            raise ImportValidationError(f"{ctx}: title must be a non-empty string ≤ 200 chars")

    # ── Tags ───────────────────────────────────────────────────────────────
    for r in data["tags"]:
        ctx = f"tags[id={r.get('id')}]"
        name = r.get("name", "")
        if not isinstance(name, str) or not name.strip() or len(name) > 50:
            raise ImportValidationError(f"{ctx}: name must be a non-empty string ≤ 50 chars")

    # ── Reference links ────────────────────────────────────────────────────
    for r in data["reference_links"]:
        ctx = f"reference_links[id={r.get('id')}]"
        url = r.get("url", "")
        if not isinstance(url, str) or not url or len(url) > 2000:
            raise ImportValidationError(f"{ctx}: url must be a non-empty string ≤ 2000 chars")
        if not (url.startswith("http://") or url.startswith("https://")):
            raise ImportValidationError(f"{ctx}: url must start with http:// or https://")

    # ── Templates ──────────────────────────────────────────────────────────
    for r in data["templates"]:
        ctx = f"templates[id={r.get('id')}]"
        title = r.get("title", "")
        if not isinstance(title, str) or not title.strip() or len(title) > 100:
            raise ImportValidationError(f"{ctx}: title must be a non-empty string ≤ 100 chars")
        if len(r.get("description", "")) > 500:
            raise ImportValidationError(f"{ctx}: description must be ≤ 500 chars")

    # ── Template tasks ─────────────────────────────────────────────────────
    for r in data["template_tasks"]:
        ctx = f"template_tasks[id={r.get('id')}]"
        title = r.get("title", "")
        if not isinstance(title, str) or not title.strip() or len(title) > 200:
            raise ImportValidationError(f"{ctx}: title must be a non-empty string ≤ 200 chars")
        priority = r.get("priority", "medium")
        if priority not in _VALID_PRIORITIES:
            raise ImportValidationError(f"{ctx}: priority must be one of {sorted(_VALID_PRIORITIES)}, got {priority!r}")
        rel_days = r.get("relative_days", 0)
        if not isinstance(rel_days, (int, float)) or int(rel_days) < 0 or int(rel_days) > 365:
            raise ImportValidationError(f"{ctx}: relative_days must be 0–365, got {rel_days!r}")
        if len(r.get("description", "")) > 5000:
            raise ImportValidationError(f"{ctx}: description must be ≤ 5000 chars")

    # ── Weekly reviews ─────────────────────────────────────────────────────
    for r in data["weekly_reviews"]:
        ctx = f"weekly_reviews[id={r.get('id')}]"
        if len(r.get("notes", "")) > 500:
            raise ImportValidationError(f"{ctx}: notes must be ≤ 500 chars")


def _validate_import_refs(data: dict) -> None:
    """Validate internal FK references and limit constraints.

    Called after structural validation, before writing anything.
    """
    item_ids = {r["id"] for r in data["items"] if isinstance(r.get("id"), int)}
    task_ids = {r["id"] for r in data["tasks"] if isinstance(r.get("id"), int)}
    tag_ids = {r["id"] for r in data["tags"] if isinstance(r.get("id"), int)}
    template_ids = {r["id"] for r in data["templates"] if isinstance(r.get("id"), int)}

    # items.area_id → an Area in the same file (absent in exports made before it existed)
    item_types = {r["id"]: r.get("type") for r in data["items"] if isinstance(r.get("id"), int)}
    for r in data["items"]:
        area_id = r.get("area_id")
        if area_id is None:
            continue
        if r.get("type") != "project":
            raise ImportValidationError(f"Item id={r.get('id')} is not a project but has area_id={area_id}")
        if item_types.get(area_id) != "area":
            raise ImportValidationError(f"Project id={r.get('id')} references area_id={area_id}, which is not an Area in the file")

    # tasks.item_id → items.id (NULL is allowed = inbox)
    for t in data["tasks"]:
        item_id = t.get("item_id")
        if item_id is not None and item_id not in item_ids:
            raise ImportValidationError(
                f"Task id={t.get('id')} references unknown item_id={item_id}"
            )

    # Task limit: max 100 per item
    tasks_per_item: dict[int, int] = {}
    for t in data["tasks"]:
        iid = t.get("item_id")
        if iid is not None:
            tasks_per_item[iid] = tasks_per_item.get(iid, 0) + 1
    for iid, count in tasks_per_item.items():
        if count > 100:
            raise ImportValidationError(
                f"Item id={iid} has {count} tasks, exceeds limit of 100"
            )

    # subtasks.task_id → tasks.id
    for s in data["subtasks"]:
        tid = s.get("task_id")
        if tid not in task_ids:
            raise ImportValidationError(
                f"Subtask id={s.get('id')} references unknown task_id={tid}"
            )

    # task_tags: both task_id and tag_id must exist
    tags_per_task: dict[int, int] = {}
    seen_task_tags: set[tuple] = set()
    for tt in data["task_tags"]:
        task_id = tt.get("task_id")
        tag_id = tt.get("tag_id")
        if task_id not in task_ids:
            raise ImportValidationError(f"task_tag references unknown task_id={task_id}")
        if tag_id not in tag_ids:
            raise ImportValidationError(f"task_tag references unknown tag_id={tag_id}")
        pair = (task_id, tag_id)
        if pair in seen_task_tags:
            raise ImportValidationError(f"Duplicate task_tag ({task_id}, {tag_id})")
        seen_task_tags.add(pair)
        tags_per_task[task_id] = tags_per_task.get(task_id, 0) + 1

    for task_id, count in tags_per_task.items():
        if count > 20:
            raise ImportValidationError(
                f"Task id={task_id} has {count} tags, exceeds limit of 20"
            )

    # reference_links.item_id → items.id
    for l in data["reference_links"]:
        iid = l.get("item_id")
        if iid not in item_ids:
            raise ImportValidationError(
                f"reference_link id={l.get('id')} references unknown item_id={iid}"
            )

    # resource_links.resource_id and linked_item_id → items.id
    for l in data["resource_links"]:
        for fk in ("resource_id", "linked_item_id"):
            iid = l.get(fk)
            if iid not in item_ids:
                raise ImportValidationError(
                    f"resource_link id={l.get('id')} references unknown {fk}={iid}"
                )

    # template_tasks.template_id → templates.id
    tasks_per_template: dict[int, int] = {}
    for tt in data["template_tasks"]:
        tid = tt.get("template_id")
        if tid not in template_ids:
            raise ImportValidationError(
                f"template_task id={tt.get('id')} references unknown template_id={tid}"
            )
        tasks_per_template[tid] = tasks_per_template.get(tid, 0) + 1

    for tid, count in tasks_per_template.items():
        if count > 50:
            raise ImportValidationError(
                f"Template id={tid} has {count} tasks, exceeds limit of 50"
            )


# ---------------------------------------------------------------------------
# Import — merge mode
# ---------------------------------------------------------------------------

def _import_merge(session: Session, data: dict) -> dict[str, int]:
    """Import data in merge mode: all records get new IDs, FKs remapped.

    Tags are merged case-insensitively with existing tags.
    Existing user_preferences are NOT overwritten.
    """
    from datetime import date as _date

    counts: dict[str, int] = {}
    now = datetime.now(timezone.utc)

    # Map old_id → new_id for each table
    item_id_map: dict[int, int] = {}
    task_id_map: dict[int, int] = {}
    tag_id_map: dict[int, int] = {}
    template_id_map: dict[int, int] = {}

    # ── Items ──────────────────────────────────────────────────────────────
    for r in data["items"]:
        item = Item(
            type=r["type"], title=r["title"],
            description=r.get("description", ""), notes=r.get("notes", ""),
            archived_at=_iso_to_dt(r.get("archived_at")),
            created_at=_iso_to_dt(r.get("created_at")) or now,
            updated_at=_iso_to_dt(r.get("updated_at")) or now,
            project_goal=r.get("project_goal"),
            project_deadline=(
                _date.fromisoformat(r["project_deadline"])
                if r.get("project_deadline") else None
            ),
            project_status=r.get("project_status"),
            project_completed_at=_iso_to_dt(r.get("project_completed_at")),
            area_maintenance_notes=r.get("area_maintenance_notes"),
        )
        session.add(item)
        session.flush()
        item_id_map[r["id"]] = item.id
    counts["items"] = len(item_id_map)

    # Parent Areas are set once every item has its new id
    for r in data["items"]:
        if r.get("area_id") is not None:
            session.get(Item, item_id_map[r["id"]]).area_id = item_id_map[r["area_id"]]
    session.flush()

    # ── Tasks ──────────────────────────────────────────────────────────────
    for r in data["tasks"]:
        t = Task(
            item_id=item_id_map.get(r["item_id"]) if r.get("item_id") is not None else None,
            title=r["title"],
            description=r.get("description", ""), notes=r.get("notes", ""),
            due_date=(
                _date.fromisoformat(r["due_date"]) if r.get("due_date") else None
            ),
            priority=r.get("priority", "medium"),
            is_complete=int(r.get("is_complete", 0)),
            sort_order=int(r.get("sort_order", 0)),
            created_at=_iso_to_dt(r.get("created_at")) or now,
            updated_at=_iso_to_dt(r.get("updated_at")) or now,
            focus_date=_date.fromisoformat(r["focus_date"]) if r.get("focus_date") else None,
            waiting_for=r.get("waiting_for"),
            waiting_since=_iso_to_dt(r.get("waiting_since")),
            defer_until=_date.fromisoformat(r["defer_until"]) if r.get("defer_until") else None,
            is_someday=1 if r.get("is_someday") else 0,
        )
        session.add(t)
        session.flush()
        task_id_map[r["id"]] = t.id
    counts["tasks"] = len(task_id_map)

    # ── Subtasks ───────────────────────────────────────────────────────────
    subtask_count = 0
    for r in data["subtasks"]:
        new_task_id = task_id_map.get(r["task_id"])
        if new_task_id is None:
            continue
        s = Subtask(
            task_id=new_task_id,
            title=r["title"],
            is_complete=int(r.get("is_complete", 0)),
            sort_order=int(r.get("sort_order", 0)),
            created_at=_iso_to_dt(r.get("created_at")) or now,
            updated_at=_iso_to_dt(r.get("updated_at")) or now,
        )
        session.add(s)
        subtask_count += 1
    counts["subtasks"] = subtask_count
    session.flush()

    # ── Tags (merge case-insensitively) ────────────────────────────────────
    from sqlalchemy import func as sqlfunc
    existing_tags: dict[str, Tag] = {
        t.name.lower(): t
        for t in session.execute(select(Tag)).scalars().all()
    }
    tag_count = 0
    for r in data["tags"]:
        name_lower = r["name"].lower()
        if name_lower in existing_tags:
            tag_id_map[r["id"]] = existing_tags[name_lower].id
        else:
            tag = Tag(
                name=r["name"],
                created_at=_iso_to_dt(r.get("created_at")) or now,
            )
            session.add(tag)
            session.flush()
            tag_id_map[r["id"]] = tag.id
            existing_tags[name_lower] = tag
            tag_count += 1
    counts["tags_new"] = tag_count
    counts["tags_merged"] = len(data["tags"]) - tag_count

    # ── TaskTags ───────────────────────────────────────────────────────────
    task_tag_count = 0
    seen_pairs: set[tuple] = set()
    for r in data["task_tags"]:
        new_task_id = task_id_map.get(r["task_id"])
        new_tag_id = tag_id_map.get(r["tag_id"])
        if new_task_id is None or new_tag_id is None:
            continue
        pair = (new_task_id, new_tag_id)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        session.add(TaskTag(task_id=new_task_id, tag_id=new_tag_id))
        task_tag_count += 1
    counts["task_tags"] = task_tag_count
    session.flush()

    # ── Reference links ────────────────────────────────────────────────────
    ref_count = 0
    for r in data["reference_links"]:
        new_item_id = item_id_map.get(r["item_id"])
        if new_item_id is None:
            continue
        session.add(ReferenceLink(
            item_id=new_item_id, url=r["url"],
            sort_order=int(r.get("sort_order", 0)),
            created_at=_iso_to_dt(r.get("created_at")) or now,
        ))
        ref_count += 1
    counts["reference_links"] = ref_count
    session.flush()

    # ── Resource links ─────────────────────────────────────────────────────
    res_count = 0
    seen_res_pairs: set[tuple] = set()
    for r in data["resource_links"]:
        new_resource_id = item_id_map.get(r["resource_id"])
        new_linked_id = item_id_map.get(r["linked_item_id"])
        if new_resource_id is None or new_linked_id is None:
            continue
        pair = (new_resource_id, new_linked_id)
        if pair in seen_res_pairs:
            continue
        seen_res_pairs.add(pair)
        session.add(ResourceLink(
            resource_id=new_resource_id, linked_item_id=new_linked_id,
            created_at=_iso_to_dt(r.get("created_at")) or now,
        ))
        res_count += 1
    counts["resource_links"] = res_count
    session.flush()

    # ── Templates ─────────────────────────────────────────────────────────
    for r in data["templates"]:
        tmpl = Template(
            title=r["title"], description=r.get("description", ""),
            created_at=_iso_to_dt(r.get("created_at")) or now,
            updated_at=_iso_to_dt(r.get("updated_at")) or now,
        )
        session.add(tmpl)
        session.flush()
        template_id_map[r["id"]] = tmpl.id
    counts["templates"] = len(template_id_map)

    # ── Template tasks ─────────────────────────────────────────────────────
    tt_count = 0
    for r in data["template_tasks"]:
        new_tmpl_id = template_id_map.get(r["template_id"])
        if new_tmpl_id is None:
            continue
        session.add(TemplateTask(
            template_id=new_tmpl_id, title=r["title"],
            description=r.get("description", ""),
            priority=r.get("priority", "medium"),
            relative_days=int(r.get("relative_days", 0)),
            sort_order=int(r.get("sort_order", 0)),
        ))
        tt_count += 1
    counts["template_tasks"] = tt_count
    session.flush()

    # ── Weekly reviews ─────────────────────────────────────────────────────
    review_count = 0
    for r in data["weekly_reviews"]:
        completed_at = _iso_to_dt(r.get("completed_at"))
        if completed_at is None:
            continue
        session.add(WeeklyReview(
            completed_at=completed_at, notes=r.get("notes", "")
        ))
        review_count += 1
    counts["weekly_reviews"] = review_count
    session.flush()

    # ── User preferences (do NOT overwrite existing) ───────────────────────
    pref_count = 0
    for r in data["user_preferences"]:
        key = r.get("key")
        if not key:
            continue
        existing = session.get(UserPreference, key)
        if existing is not None:
            continue  # preserve existing
        session.add(UserPreference(
            key=key, value=r.get("value", ""),
            updated_at=_iso_to_dt(r.get("updated_at")) or now,
        ))
        pref_count += 1
    counts["user_preferences_added"] = pref_count
    session.flush()

    return counts


# ---------------------------------------------------------------------------
# Import — replace mode
# ---------------------------------------------------------------------------

def _import_replace(session: Session, data: dict, db_path, backup_dir) -> dict[str, int]:
    """Import data in replace mode: backup first, then wipe all data, then insert."""
    from pathlib import Path

    # Create backup and verify it
    from backend.services import backup_service
    try:
        backup_path = backup_service.create_backup(
            db_path=Path(db_path), backup_dir=Path(backup_dir), trigger="pre-import-replace"
        )
        if not backup_path.exists() or backup_path.stat().st_size == 0:
            raise ImportFailedError("Backup file is empty or missing; aborting replace import.")
        # Quick sanity check: try to open the backup
        import sqlite3 as _sqlite3
        with _sqlite3.connect(str(backup_path)) as _conn:
            _conn.execute("SELECT count(*) FROM sqlite_master")
    except ImportFailedError:
        raise
    except Exception as exc:
        raise ImportFailedError(f"Pre-import backup failed: {exc}") from exc

    # Delete in reverse FK order
    _delete_all(session)

    # Now merge (same as merge mode, but starting from empty DB)
    return _import_merge(session, data)


def _delete_all(session: Session) -> None:
    """Delete all user data in FK-safe order (leave schema intact)."""
    # SQLite cascade handles FK children if PRAGMA foreign_keys=ON (set in database.py)
    # but deleting parent tables first in safe order is also fine
    for table in (
        "task_tags", "subtasks", "resource_links", "reference_links",
        "tasks", "items", "tags", "template_tasks", "templates",
        "weekly_reviews", "user_preferences",
        # Undo snapshots belong to the replaced data and must not resurrect it
        "undo_entries",
    ):
        session.execute(text(f"DELETE FROM {table}"))


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def import_data(
    session: Session,
    data: Any,
    mode: str,
    db_path: str | None = None,
    backup_dir: str | None = None,
) -> dict[str, int]:
    """Validate and import data.

    Args:
        session: SQLAlchemy session.
        data: Parsed JSON dict from the upload.
        mode: "merge" or "replace".
        db_path: Path to the source DB (needed for replace mode backup).
        backup_dir: Path to the backup directory (needed for replace mode).

    Returns:
        Dict of record counts written.

    Raises:
        ImportValidationError: Structural or FK validation failure (no data changed).
        ImportFailedError: Backup failed or unexpected write error (data is intact).
    """
    if mode not in {"merge", "replace"}:
        raise ImportValidationError(f"mode must be 'merge' or 'replace', got {mode!r}")

    if mode == "replace" and (not db_path or not backup_dir):
        raise ImportValidationError("db_path and backup_dir are required for replace mode")

    # 1. Structural validation (no DB access)
    validate_export_data(data)

    # 2. Internal FK + limit validation
    _validate_import_refs(data)

    # 3. Write (everything in the caller's transaction)
    if mode == "merge":
        return _import_merge(session, data)
    else:
        return _import_replace(session, data, db_path, backup_dir)
