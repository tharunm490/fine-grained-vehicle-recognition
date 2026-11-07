import json
from pathlib import Path

from app.config import CLASS_NAMES_PATH


class CheckpointError(RuntimeError):
    pass


def load_class_names(path: Path = CLASS_NAMES_PATH) -> list[str]:
    try:
        names = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise CheckpointError(f"Unable to read class mapping: {exc}") from exc
    if not isinstance(names, list) or len(names) != 196:
        raise CheckpointError("Class mapping must contain exactly 196 Stanford Cars classes")
    return names


def file_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except OSError:
        return 0
