import pytest

from scripts.foundry_to_github_pr import _validate_rel_path, _is_probably_secret_path


@pytest.mark.parametrize(
    "path",
    [
        ".env",
        ".env.local",
        "secrets.txt",
        "api_token.txt",
        "keys/private.key",
        ".git/config",
    ],
)
def test_is_probably_secret_path(path: str):
    assert _is_probably_secret_path(path) is True


def test_validate_rel_path_rejects_parent_traversal():
    with pytest.raises(SystemExit):
        _validate_rel_path("../x.txt", allow_prefix="")


def test_validate_rel_path_rejects_absolute():
    with pytest.raises(SystemExit):
        _validate_rel_path("/etc/passwd", allow_prefix="")


def test_validate_rel_path_rejects_secretish_paths():
    with pytest.raises(SystemExit):
        _validate_rel_path(".env", allow_prefix="")


def test_validate_rel_path_allow_prefix_enforced():
    with pytest.raises(SystemExit):
        _validate_rel_path("index.html", allow_prefix="site/")

    # Allowed
    _validate_rel_path("site/index.html", allow_prefix="site/")
