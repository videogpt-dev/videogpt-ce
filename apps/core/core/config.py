import os
from pathlib import Path


class Settings:
    def __init__(self) -> None:
        self.kinoforge_url = os.getenv("KINOFORGE_URL") or "http://127.0.0.1:8100"
        self.infrelay_url = os.getenv("INFRELAY_URL") or "http://127.0.0.1:8090"
        self.data_dir = Path(os.getenv("CORE_DATA_DIR") or "./data").resolve()
        self.output_dir = Path(
            os.getenv("KINOFORGE_SHARED_ROOT") or (self.data_dir / "output")
        ).resolve()

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"


settings = Settings()
