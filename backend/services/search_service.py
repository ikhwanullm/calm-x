"""Global search service (R9.6, R9.7)."""
from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.models.item import Item, Task

MAX_RESULTS = 100


def _escape(q: str) -> str:
    """Escape SQL LIKE wildcards (%, _, backslash)."""
    return q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search(session: Session, query: str) -> list[dict]:
    """Search Items and Tasks by title/description.

    Returns up to 100 results. Escaped LIKE for %, _, \.
    Empty query returns empty list (not all data).
    Archived items/tasks are labelled "(Archived)".
    """
    if not query.strip():
        return []

    escaped = _escape(query.strip())
    pattern = f"%{escaped}%"

    results: list[dict] = []

    # --- Search Items ---
    items = session.execute(
        select(Item).where(
            or_(
                Item.title.ilike(pattern, escape="\\"),
                Item.description.ilike(pattern, escape="\\"),
            )
        ).limit(MAX_RESULTS)
    ).scalars().all()

    for item in items:
        label = item.title
        if item.archived_at is not None:
            label = f"{item.title} (Archived)"
        results.append({
            "type": "item",
            "id": item.id,
            "title": label,
            "item_type": item.type,
            "is_archived": item.archived_at is not None,
            "item_id": None,
        })

    # --- Search Tasks ---
    remaining = MAX_RESULTS - len(results)
    if remaining > 0:
        tasks = session.execute(
            select(Task).where(
                or_(
                    Task.title.ilike(pattern, escape="\\"),
                    Task.description.ilike(pattern, escape="\\"),
                )
            ).limit(remaining)
        ).scalars().all()

        for task in tasks:
            parent = session.get(Item, task.item_id) if task.item_id else None
            is_archived = parent.archived_at is not None if parent else False
            label = task.title
            if is_archived:
                label = f"{task.title} (Archived)"
            results.append({
                "type": "task",
                "id": task.id,
                "title": label,
                "item_type": parent.type if parent else None,
                "is_archived": is_archived,
                "item_id": task.item_id,
            })

    return results[:MAX_RESULTS]
