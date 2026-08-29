import os
from pathlib import Path


class Settings:
    def __init__(self) -> None:
        self.kinoforge_url = os.getenv("KINOFORGE_URL") or "http://127.0.0.1:8100"
        self.infrelay_url = os.getenv("INFRELAY_URL") or "http://127.0.0.1:8090"
        self.editor_url = os.getenv("EDITOR_URL") or "http://127.0.0.1:3000"
        self.data_dir = Path(os.getenv("CORE_DATA_DIR") or "./data").resolve()
        self.output_dir = Path(
            os.getenv("KINOFORGE_SHARED_ROOT") or (self.data_dir / "output")
        ).resolve()
        self.story_provider = os.getenv("STORY_TEXT_PROVIDER") or "openrouter"
        self.story_model = os.getenv("STORY_TEXT_MODEL") or "openai/gpt-4o-mini"
        self.story_token_budget = int(os.getenv("STORY_TOKEN_BUDGET") or 4000)
        self.image_provider = os.getenv("STORY_IMAGE_PROVIDER") or "fal"
        self.image_model = os.getenv("STORY_IMAGE_MODEL") or "fal-ai/flux/schnell"
        self.tts_provider = os.getenv("STORY_TTS_PROVIDER") or "edge"
        self.tts_voice = os.getenv("STORY_TTS_VOICE") or "en-US-AriaNeural"
        self.music_provider = os.getenv("STORY_MUSIC_PROVIDER") or "fal"
        self.music_model = os.getenv("STORY_MUSIC_MODEL") or ""
        self.story_fps = int(os.getenv("STORY_FPS") or 30)

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"


settings = Settings()
