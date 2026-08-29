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
        self.story_provider = os.getenv("STORY_TEXT_PROVIDER") or "openrouter"
        self.story_model = os.getenv("STORY_TEXT_MODEL") or "openai/gpt-4o-mini"
        self.story_token_budget = int(os.getenv("STORY_TOKEN_BUDGET") or 4000)

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"


settings = Settings()
