import base64

from fastapi.testclient import TestClient

from infrelay_lite.app import app

client = TestClient(app)


def test_health_open():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["service"] == "infrelay-lite"


def test_models_lists_providers_per_kind():
    res = client.get("/v1/models?kind=video")
    assert res.status_code == 200
    assert res.json()["items"] == [{"provider": "fal", "kind": "video"}]


def test_generate_text_via_openrouter(monkeypatch):
    class FakeMessage:
        content = "hello world"

    class FakeChoice:
        message = FakeMessage()
        finish_reason = "stop"

    class FakeUsage:
        prompt_tokens = 5
        completion_tokens = 2

    class FakeResp:
        choices = [FakeChoice()]
        usage = FakeUsage()
        model = "meta/llama"

    class FakeOpenAI:
        def __init__(self, *a, **k):
            self.chat = self

        @property
        def completions(self):
            return self

        def create(self, **kwargs):
            return FakeResp()

    import openai

    monkeypatch.setattr(openai, "OpenAI", FakeOpenAI)

    body = {
        "kind": "text",
        "provider": "openrouter",
        "model": "meta/llama",
        "input": {"system": "s", "user": "hi", "max_tokens": 100, "temperature": 0.5},
        "credential": {"api_key": "sk-test"},
    }
    res = client.post("/v1/generate", json=body)
    assert res.status_code == 200
    data = res.json()
    assert data["output"]["type"] == "text"
    assert data["output"]["value"] == "hello world"
    assert data["output"]["meta"]["finish_reason"] == "stop"
    assert data["usage"]["byok"] is True


def test_generate_image_via_fal_returns_url(monkeypatch):
    monkeypatch.setattr(
        "infrelay_lite.adapters.image.fal_subscribe",
        lambda model, args, token: {"images": [{"url": "https://cdn/x.png"}]},
    )
    body = {
        "kind": "image",
        "provider": "fal",
        "model": "fal-ai/flux",
        "input": {"prompt": "a lighthouse", "aspect_ratio": "9:16"},
        "credential": {"api_key": "fal-test"},
    }
    res = client.post("/v1/generate", json=body)
    assert res.status_code == 200
    out = res.json()["output"]
    assert out["type"] == "url"
    assert out["value"] == "https://cdn/x.png"


def test_unknown_provider_rejected():
    body = {"kind": "image", "provider": "replicate", "model": "x", "input": {"prompt": "p"}}
    res = client.post("/v1/generate", json=body)
    assert res.status_code == 502
    assert "serves only" in res.json()["detail"]


def test_no_key_surfaces_adapter_error(monkeypatch):
    # No credential and no env key -> the adapter refuses before any provider call.
    body = {
        "kind": "music",
        "provider": "fal",
        "model": "fal-ai/music",
        "input": {"prompt": "moody"},
    }
    res = client.post("/v1/generate", json=body)
    assert res.status_code == 502
    assert "API key" in res.json()["detail"]


def test_b64_unused_here_but_shape_holds():
    # Guards the output envelope Kinoforge decodes: b64 round-trips through as_dict.
    from infrelay_lite.adapters.base import Output

    payload = base64.b64encode(b"abc").decode()
    assert Output(type="b64", value=payload).as_dict()["value"] == payload
