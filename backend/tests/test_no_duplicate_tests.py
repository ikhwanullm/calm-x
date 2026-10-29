"""Guard: a test function defined twice in one module silently shadows the first copy."""
import ast
from collections import Counter
from pathlib import Path

TESTS_DIR = Path(__file__).parent


def duplicate_test_names(source: str) -> list[str]:
    """Names of top-level test functions defined more than once in the source."""
    names = [
        node.name
        for node in ast.parse(source).body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test_")
    ]
    return sorted(name for name, count in Counter(names).items() if count > 1)


def test_no_module_defines_the_same_test_twice():
    problems = {
        path.name: dupes
        for path in sorted(TESTS_DIR.glob("test_*.py"))
        if (dupes := duplicate_test_names(path.read_text(encoding="utf-8")))
    }
    assert problems == {}, f"Duplicate test names (the first copy never runs): {problems}"


def test_guard_detects_a_duplicate():
    source = "def test_a():\n    pass\n\n\ndef test_b():\n    pass\n\n\ndef test_a():\n    pass\n"
    assert duplicate_test_names(source) == ["test_a"]
    assert duplicate_test_names("def test_a():\n    pass\n\ndef helper():\n    pass\n\ndef helper():\n    pass\n") == []
