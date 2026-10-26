"""Tests for ORM models — imports, instantiation, and cascade config."""
import pytest
from sqlalchemy import inspect


def test_item_model_imports():
    from backend.models.item import Item, Task, Subtask, Tag, TaskTag, ReferenceLink, ResourceLink
    assert Item.__tablename__ == "items"
    assert Task.__tablename__ == "tasks"


def test_item_relationships_have_cascade(tmp_path):
    from backend.database import get_engine, Base
    from backend.models.item import Item  # noqa: ensure registered

    engine = get_engine(f"sqlite:///{tmp_path/'m.db'}")
    Base.metadata.create_all(engine)

    mapper = inspect(Item)
    rels = {r.key: r for r in mapper.relationships}
    for rel_name in ["tasks", "reference_links", "resource_links_as_resource", "resource_links_as_linked"]:
        assert rel_name in rels, f"Missing relationship: {rel_name}"
        rel = rels[rel_name]
        assert rel.passive_deletes, f"{rel_name} missing passive_deletes=True"


def test_now_utc_returns_naive_datetime():
    from backend.models.utils import now_utc
    from datetime import timezone
    dt = now_utc()
    assert dt.tzinfo is None  # stored as naive UTC


def test_now_utc_is_recent():
    from backend.models.utils import now_utc
    from datetime import datetime, timezone
    dt = now_utc()
    delta = abs((datetime.now(timezone.utc).replace(tzinfo=None) - dt).total_seconds())
    assert delta < 2.0
