from collections.abc import Callable

import httpx2
import pytest
from fastapi.testclient import TestClient

from ca_agent.config import Config
from ca_agent.main import create_app

TOKEN = "test-token-0123456789-0123456789-0123456789"

SearchHandler = Callable[[httpx2.Request], httpx2.Response]


def search_is_up(_: httpx2.Request) -> httpx2.Response:
    return httpx2.Response(200, json={"status": "ok", "service": "search"})


def search_is_down(request: httpx2.Request) -> httpx2.Response:
    raise httpx2.ConnectError("ingen lytter", request=request)


@pytest.fixture
def make_client() -> Callable[..., TestClient]:
    """Ekte app, falsk search. Ingenting forlater prosessen."""

    def build(
        search: SearchHandler = search_is_up,
        anthropic_api_key: str | None = None,
    ) -> TestClient:
        config = Config(
            internal_token=TOKEN,
            search_url="http://search.test",
            anthropic_api_key=anthropic_api_key,
            anthropic_model="claude-opus-5-5",
            bind_host="127.0.0.1",
            bind_port=0,
        )
        return TestClient(create_app(config, search_transport=httpx2.MockTransport(search)))

    return build


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> TestClient:
    return make_client()


@pytest.fixture
def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {TOKEN}"}
