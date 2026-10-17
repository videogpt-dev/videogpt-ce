import base64
import json

from fastapi.testclient import TestClient

from infrelay_lite.app import app
from infrelay_lite.config import settings

client = TestClient(app)


def test_health_open():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["service"] == "infrelay-lite"


def test_models_lists_providers_per_kind_or_all():
    res = client.get("/v1/models/video")
    assert res.status_code == 200
    assert [i["provider"] for i in res.json()["items"]] == ["cloud", "fal"]
    assert client.get("/v1/models/all", params={"per_page": 2}).json()["per_page"] == 2
    assert client.get("/v1/models/story.video").status_code == 404
    assert client.get("/v1/models/hologram").status_code == 404


def test_tasks_lists_every_task_with_its_kind_and_group():
    items = {i["task"]: i for i in client.get("/v1/tasks").json()["items"]}
    assert items["story.video"] == {"task": "story.video", "kind": "video", "group": "story"}
    assert items["image"]["group"] == "general"
    assert items["viralClip.find"]["kind"] == "text"


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
        "inference": {"provider": "openrouter", "model": "meta/llama"},
        "input": {"system": "s", "user": "hi", "max_tokens": 100, "temperature": 0.5},
        "credential": {"api_key": "sk-test"},
    }
    res = client.post("/v1/inference/story.write", json=body)
    assert res.status_code == 200
    data = res.json()
    assert (data["task"], data["kind"], data["provider"]) == ("story.write", "text", "openrouter")
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
        "inference": {"provider": "fal", "model": "fal-ai/flux"},
        "input": {"prompt": "a lighthouse", "aspect_ratio": "9:16"},
        "credential": {"api_key": "fal-test"},
    }
    res = client.post("/v1/inference/image", json=body)
    assert res.status_code == 200
    out = res.json()["output"]
    assert out["type"] == "url"
    assert out["value"] == "https://cdn/x.png"


def test_unknown_provider_rejected():
    body = {"inference": {"provider": "replicate", "model": "x"}, "input": {"prompt": "p"}}
    res = client.post("/v1/inference/image", json=body)
    assert res.status_code == 502
    assert "serves only" in res.json()["detail"]


def test_no_key_surfaces_adapter_error(monkeypatch):
    # No credential and no env key -> the adapter refuses before any provider call.
    body = {"inference": {"provider": "fal", "model": "fal-ai/music"}, "input": {"prompt": "moody"}}
    res = client.post("/v1/inference/music", json=body)
    assert res.status_code == 502
    assert "API key" in res.json()["detail"]


def _fal_images(monkeypatch, seen: list) -> None:
    def subscribe(model, args, token):
        seen.append(model)
        if model == "fal-ai/broken":
            from infrelay_lite.adapters.base import AdapterError

            raise AdapterError("broken is down")
        return {"images": [{"url": f"https://cdn/{model}.png"}]}

    monkeypatch.setattr("infrelay_lite.adapters.image.fal_subscribe", subscribe)
    monkeypatch.setattr(settings(), "fal_key", "fal-env")


def test_auto_walks_the_tasks_route_else_its_kinds(monkeypatch):
    seen: list = []
    _fal_images(monkeypatch, seen)
    routes = {
        "image": ["fal/fal-ai/broken", "fal/fal-ai/flux/schnell"],
        "story.cast": ["fal/fal-ai/x"],
    }
    monkeypatch.setattr(settings(), "infrelay_routes", json.dumps(routes))

    scene = client.post("/v1/inference/story.image", json={"input": {"prompt": "p"}})
    cast = client.post(
        "/v1/inference/story.cast", json={"inference": "auto", "input": {"prompt": "p"}}
    )

    assert (scene.status_code, scene.json()["model"]) == (200, "fal-ai/flux/schnell")
    assert cast.json()["model"] == "fal-ai/x"
    assert seen == ["fal-ai/broken", "fal-ai/flux/schnell", "fal-ai/x"]


def test_excluded_models_are_skipped_so_the_route_moves_on(monkeypatch):
    seen: list = []
    _fal_images(monkeypatch, seen)
    routes = {"image": ["fal/fal-ai/a", "fal/fal-ai/b"]}
    monkeypatch.setattr(settings(), "infrelay_routes", json.dumps(routes))

    def ask(exclude):
        pick = {"model": "auto", "exclude": exclude}
        return client.post(
            "/v1/inference/image", json={"inference": pick, "input": {"prompt": "p"}}
        )

    skipped = ask([{"provider": "fal", "model": "fal-ai/a"}])
    nothing = ask(["fal-ai/a", "fal-ai/b"])

    assert (skipped.json()["model"], seen) == ("fal-ai/b", ["fal-ai/b"])
    assert nothing.status_code == 404


def test_without_a_route_auto_has_nothing_to_run(monkeypatch):
    monkeypatch.setattr(settings(), "infrelay_routes", "")
    res = client.post("/v1/inference/story.video", json={"input": {"prompt": "p"}})
    assert res.status_code == 404


def test_fallbacks_run_in_order_and_are_capped(monkeypatch):
    seen: list = []
    _fal_images(monkeypatch, seen)
    pick = {
        "provider": "fal",
        "model": "fal-ai/broken",
        "fallback": {"provider": "fal", "model": "fal-ai/y"},
    }

    res = client.post("/v1/inference/image", json={"inference": pick, "input": {"prompt": "p"}})
    too_many = {**pick, "fallback": [{"model": "a"}] * 4}

    assert (res.json()["model"], seen) == ("fal-ai/y", ["fal-ai/broken", "fal-ai/y"])
    assert (
        client.post("/v1/inference/image", json={"inference": too_many, "input": {}}).status_code
        == 422
    )


def test_a_named_model_runs_on_a_provider_with_a_key(monkeypatch):
    seen: list = []
    _fal_images(monkeypatch, seen)

    res = client.post(
        "/v1/inference/image", json={"inference": "fal-ai/z", "input": {"prompt": "p"}}
    )

    assert (res.json()["provider"], res.json()["model"]) == ("fal", "fal-ai/z")


def test_a_queued_call_is_refused():
    body = {"input": {"prompt": "p"}, "callback_url": "http://core/hook"}
    assert client.post("/v1/inference/video", json=body).status_code == 400


def test_b64_unused_here_but_shape_holds():
    # Guards the output envelope Kinoforge decodes: b64 round-trips through as_dict.
    from infrelay_lite.adapters.base import Output

    payload = base64.b64encode(b"abc").decode()
    assert Output(type="b64", value=payload).as_dict()["value"] == payload
