import json
import time
import uuid
from typing import Any

from core.config import settings


def _path(project_id: str):
    return settings.projects_dir / f"{project_id}.json"


def list_projects() -> list[dict[str, Any]]:
    settings.projects_dir.mkdir(parents=True, exist_ok=True)
    out: list[dict[str, Any]] = []
    for f in sorted(settings.projects_dir.glob("*.json")):
        out.append(json.loads(f.read_text()))
    out.sort(key=lambda p: p.get("created_at", 0), reverse=True)
    return out


def get_project(project_id: str) -> dict[str, Any] | None:
    f = _path(project_id)
    if not f.exists():
        return None
    return json.loads(f.read_text())


def create_project(title: str, kind: str) -> dict[str, Any]:
    settings.projects_dir.mkdir(parents=True, exist_ok=True)
    project = {
        "id": uuid.uuid4().hex,
        "title": title,
        "kind": kind,
        "created_at": time.time(),
    }
    _path(project["id"]).write_text(json.dumps(project, indent=2))
    return project


def save_project(project: dict[str, Any]) -> dict[str, Any]:
    settings.projects_dir.mkdir(parents=True, exist_ok=True)
    _path(project["id"]).write_text(json.dumps(project, indent=2))
    return project


def delete_project(project_id: str) -> bool:
    f = _path(project_id)
    if not f.exists():
        return False
    f.unlink()
    return True
