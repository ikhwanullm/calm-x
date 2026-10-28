"""ORM models — import all so Alembic/Base.metadata sees them."""
from backend.models.item import (  # noqa: F401
    Item,
    Task,
    Subtask,
    Tag,
    TaskTag,
    ReferenceLink,
    ResourceLink,
)

from backend.models.preference import UserPreference  # noqa: F401
from backend.models.template import Template, TemplateTask  # noqa: F401
from backend.models.weekly_review import WeeklyReview  # noqa: F401
