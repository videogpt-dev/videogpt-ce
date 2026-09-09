import asyncio
import json
import time
import traceback
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from core.config import settings

_LOG_CAP = 300


def _dir():
    d = settings.data_dir / "jobs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _path(job_id: str):
    return _dir() / f"{job_id}.json"


def get(job_id: str) -> dict[str, Any] | None:
    f = _path(job_id)
    if not f.exists():
        return None
    return json.loads(f.read_text())


def list_for_project(project_id: str) -> list[dict[str, Any]]:
    out = []
    for f in _dir().glob("*.json"):
        job = json.loads(f.read_text())
        if job.get("project_id") == project_id:
            out.append(job)
    out.sort(key=lambda j: j.get("created_at", 0), reverse=True)
    return out


class Reporter:
    def __init__(self, job: dict[str, Any]) -> None:
        self._job = job

    def _flush(self) -> None:
        _path(self._job["id"]).write_text(json.dumps(self._job))

    def phase(self, text: str, step: int | None = None, total: int | None = None) -> None:
        self._job["phase"] = text
        if step is not None:
            self._job["step"] = step
        if total is not None:
            self._job["total"] = total
        self.log(text)

    def log(self, line: str) -> None:
        line = line.rstrip()
        if not line:
            return
        logs: list[str] = self._job["logs"]
        logs.append(f"{time.strftime('%H:%M:%S')} {line}")
        if len(logs) > _LOG_CAP:
            del logs[:-_LOG_CAP]
        self._flush()


Handler = Callable[[Reporter], Awaitable[dict[str, Any]]]


def start(project_id: str, kind: str, handler: Handler) -> dict[str, Any]:
    job = {
        "id": uuid.uuid4().hex,
        "project_id": project_id,
        "kind": kind,
        "status": "running",
        "phase": "starting",
        "step": 0,
        "total": 0,
        "logs": [],
        "result": None,
        "error": None,
        "created_at": time.time(),
        "finished_at": None,
    }
    reporter = Reporter(job)
    reporter._flush()

    async def _run() -> None:
        try:
            result = await handler(reporter)
            job["result"] = result
            job["status"] = "error" if isinstance(result, dict) and result.get("error") else "done"
            if job["status"] == "error":
                job["error"] = result.get("error")
            job["phase"] = "failed" if job["status"] == "error" else "done"
        except Exception as exc:  # noqa: BLE001
            job["status"] = "error"
            job["error"] = str(exc) or exc.__class__.__name__
            job["phase"] = "failed"
            reporter.log("".join(traceback.format_exception_only(type(exc), exc)))
        finally:
            job["finished_at"] = time.time()
            reporter._flush()

    asyncio.create_task(_run())
    return job
