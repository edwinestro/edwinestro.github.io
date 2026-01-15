from examples.feedback_processor import normalize_text, categorize, process_feedback


def test_normalize_text():
    assert normalize_text("  Hello   world!  ") == "Hello world!"
    assert normalize_text("") == ""


def test_categorize_easy():
    assert categorize("There's a small typo on the start screen") == "easy"


def test_categorize_medium():
    assert categorize("Please add more levels and a leaderboard") == "medium"


def test_categorize_hard():
    assert categorize("We need to rewrite the backend architecture to scale") == "hard"


def test_process_feedback_empty():
    assert process_feedback("") == []


def test_process_feedback_structure():
    out = process_feedback("Fix spelling on the main menu")
    assert isinstance(out, list) and len(out) == 1
    item = out[0]
    assert item["category"] == "easy"
    assert item["confidence"] >= 0.5
