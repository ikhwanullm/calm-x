"""Parse the action lines of a meeting's Markdown body.

One function, used by both the live preview and the process endpoint, so they can't disagree.

Recognised lines (optionally inside a list, `- `, `* ` or `+ `; indentation is ignored):

    [ ] text        my action
    @Who: text      someone else's action (becomes a Waiting-for task)
    ? text          open question
    ! text          decision

Lines already turned into tasks are rewritten as `[→] text` / `@→Who: text` and are only
counted. A line written `[x] text` (or `[X]`) is closed: handled without a task, only counted, and it
wins over the other rules, so `[x] @Who: text` is closed too.
Lines inside ``` or ~~~ fenced code blocks are ignored, as are lines without text
(the empty `[ ]` in the new-meeting template).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

_LIST_MARKER = r"(?:[-*+]\s+)?"
_MINE = re.compile(rf"^(?P<prefix>\s*{_LIST_MARKER})\[ \]\s+(?P<text>\S.*?)\s*$")
_WAITING = re.compile(rf"^(?P<prefix>\s*{_LIST_MARKER})@(?P<who>[^:\s][^:]{{0,99}}?)\s*:\s*(?P<text>\S.*?)\s*$")
_CLOSED = re.compile(rf"^\s*{_LIST_MARKER}\[[xX]\]\s+\S")
_DONE_MINE = re.compile(rf"^\s*{_LIST_MARKER}\[→\]\s+\S")
_DONE_WAITING = re.compile(rf"^\s*{_LIST_MARKER}@→[^:]+:\s*\S")
_QUESTION = re.compile(rf"^\s*{_LIST_MARKER}\?\s+(?P<text>\S.*?)\s*$")
_DECISION = re.compile(rf"^\s*{_LIST_MARKER}!\s+(?P<text>\S.*?)\s*$")
_FENCE = re.compile(r"^\s*(```|~~~)")

ActionKind = Literal["mine", "waiting"]


@dataclass
class ParsedAction:
    line: int            # 0-based index into body.split("\n")
    kind: ActionKind
    text: str
    who: str | None = None


@dataclass
class ParsedLine:
    line: int
    text: str


@dataclass
class ParsedMeeting:
    actions: list[ParsedAction] = field(default_factory=list)
    questions: list[ParsedLine] = field(default_factory=list)
    decisions: list[ParsedLine] = field(default_factory=list)
    converted: int = 0   # lines already turned into tasks
    closed: int = 0      # lines marked [x]: handled without a task


def parse_meeting(body: str) -> ParsedMeeting:
    """Return the actions, questions and decisions found in `body`."""
    result = ParsedMeeting()
    in_fence = False
    for index, raw in enumerate(body.split("\n")):
        line = raw.rstrip("\r")
        if _FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if _CLOSED.match(line):
            result.closed += 1
        elif _DONE_MINE.match(line) or _DONE_WAITING.match(line):
            result.converted += 1
        elif m := _MINE.match(line):
            result.actions.append(ParsedAction(index, "mine", m["text"]))
        elif m := _WAITING.match(line):
            result.actions.append(ParsedAction(index, "waiting", m["text"], who=m["who"].strip()))
        elif m := _QUESTION.match(line):
            result.questions.append(ParsedLine(index, m["text"]))
        elif m := _DECISION.match(line):
            result.decisions.append(ParsedLine(index, m["text"]))
    return result


def mark_converted(body: str, actions: list[ParsedAction]) -> str:
    """Rewrite the given action lines as converted (`[→]` / `@→Who:`), leaving everything else untouched."""
    lines = body.split("\n")
    for action in actions:
        raw = lines[action.line]
        trailing = "\r" if raw.endswith("\r") else ""
        line = raw.rstrip("\r")
        if action.kind == "mine":
            m = _MINE.match(line)
            if m:
                lines[action.line] = f"{m['prefix']}[→] {m['text']}{trailing}"
        else:
            m = _WAITING.match(line)
            if m:
                lines[action.line] = f"{m['prefix']}@→{m['who'].strip()}: {m['text']}{trailing}"
    return "\n".join(lines)


def mark_closed(body: str, actions: list[ParsedAction]) -> str:
    """Rewrite the given action lines as closed (`[ ] text` -> `[x] text`, `@Who: text` -> `[x] @Who: text`)."""
    lines = body.split("\n")
    for action in actions:
        raw = lines[action.line]
        trailing = "\r" if raw.endswith("\r") else ""
        line = raw.rstrip("\r")
        if action.kind == "mine":
            m = _MINE.match(line)
            if m:
                lines[action.line] = f"{m['prefix']}[x] {m['text']}{trailing}"
        else:
            m = _WAITING.match(line)
            if m:
                lines[action.line] = f"{m['prefix']}[x] @{m['who'].strip()}: {m['text']}{trailing}"
    return "\n".join(lines)
