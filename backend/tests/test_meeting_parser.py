"""Parser for the action lines of a meeting's Markdown notes."""
from backend.services.meeting_parser import mark_converted, parse_meeting


def _actions(body):
    return [(a.line, a.kind, a.text, a.who) for a in parse_meeting(body).actions]


def test_my_actions_with_and_without_a_list_marker():
    body = "[ ] Plain\n- [ ] Dash\n* [ ] Star\n+ [ ] Plus\n  - [ ] Indented\n"
    assert _actions(body) == [
        (0, "mine", "Plain", None), (1, "mine", "Dash", None), (2, "mine", "Star", None),
        (3, "mine", "Plus", None), (4, "mine", "Indented", None),
    ]


def test_someone_elses_actions_carry_who_and_text():
    body = "@Budi: send the logs\n- @Security team :  open the port  \n"
    assert _actions(body) == [
        (0, "waiting", "send the logs", "Budi"), (1, "waiting", "open the port", "Security team"),
    ]


def test_questions_and_decisions_are_listed_separately():
    parsed = parse_meeting("? Who owns the runbook?\n- ! Ship on Friday\n! Keep the old API\n- ? Budget?\n")
    assert [(q.line, q.text) for q in parsed.questions] == [(0, "Who owns the runbook?"), (3, "Budget?")]
    assert [(d.line, d.text) for d in parsed.decisions] == [(1, "Ship on Friday"), (2, "Keep the old API")]
    assert parsed.actions == []


def test_lines_without_text_are_ignored():
    """The template's example line is `- [ ] ` with nothing after it."""
    assert _actions("- [ ] \n[ ]\n@Budi:\n@Budi:   \n") == []


def test_ordinary_text_and_other_checkbox_states_are_not_actions():
    body = "Plain text with [ ] in the middle\n[x] ticked\n[X] ticked\n@nocolon text\nemail me@x.com: now\n# ! heading\n"
    assert _actions(body) == []
    assert parse_meeting(body).questions == [] and parse_meeting(body).decisions == []


def test_already_converted_lines_are_counted_not_listed():
    parsed = parse_meeting("- [→] done\n@→Budi: done too\n[ ] open\n")
    assert parsed.converted == 2
    assert [(a.line, a.text) for a in parsed.actions] == [(2, "open")]


def test_fenced_code_blocks_are_ignored():
    body = "```\n[ ] in code\n@X: in code\n```\n[ ] real\n~~~\n? also code\n~~~\n"
    parsed = parse_meeting(body)
    assert [(a.line, a.text) for a in parsed.actions] == [(4, "real")]
    assert parsed.questions == []


def test_crlf_bodies_parse_like_lf_bodies():
    assert _actions("[ ] One\r\n@Budi: Two\r\n") == [(0, "mine", "One", None), (1, "waiting", "Two", "Budi")]


def test_mark_converted_rewrites_only_the_chosen_lines():
    body = "## Actions\n- [ ] One\n- [ ] Two\n@Budi: Three\n? Keep me\n"
    parsed = parse_meeting(body)
    out = mark_converted(body, [parsed.actions[0], parsed.actions[2]])
    assert out == "## Actions\n- [→] One\n- [ ] Two\n@→Budi: Three\n? Keep me\n"


def test_converted_lines_are_not_found_again():
    body = "- [ ] One\n@Budi: Two\n"
    out = mark_converted(body, parse_meeting(body).actions)
    again = parse_meeting(out)
    assert again.actions == [] and again.converted == 2
    assert mark_converted(out, again.actions) == out


def test_mark_converted_keeps_crlf():
    body = "[ ] One\r\n@Budi: Two\r\n"
    assert mark_converted(body, parse_meeting(body).actions) == "[→] One\r\n@→Budi: Two\r\n"
