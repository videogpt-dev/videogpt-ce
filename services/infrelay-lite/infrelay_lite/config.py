"""Runtime config. Everything from env; nothing hardcoded.

Lite has no database and no secret store: provider keys come straight from the environment
(FAL_KEY, OPENROUTER_API_KEY), and a request may still inject its own key (BYOK) per call.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    infrelay_env: str = "dev"
    # Same shared-secret gate the full gateway uses on /v1/*. Empty is allowed only in dev; any
    # other env refuses to serve the gated routes so a deploy can never be accidentally open.
    infrelay_service_token: str = ""

    # Platform provider keys. A per-request injected credential overrides these.
    fal_key: str = ""
    openrouter_api_key: str = ""

    @property
    def is_dev(self) -> bool:
        return self.infrelay_env.strip().lower() == "dev"


@lru_cache
def settings() -> Settings:
    return Settings()
