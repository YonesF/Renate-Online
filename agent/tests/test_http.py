import pytest
from conftest import TOKEN, search_is_down

from ca_agent.config import DEFAULT_MODEL, Config, ConfigError


def test_healthz_answers_without_token_and_reports_its_dependencies(client):
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "agent",
        "version": "0.1.0",
        "checks": {
            "search": "ok",
            "anthropic_key": "missing",
            "anthropic_model": "claude-opus-5-5",
        },
    }


def test_healthz_reports_search_as_unreachable_when_it_is_down(make_client):
    response = make_client(search=search_is_down).get("/healthz")

    assert response.status_code == 200
    assert response.json()["checks"]["search"] == "unreachable"


def test_healthz_says_the_key_is_set_without_showing_it(make_client):
    secret = "sk-ant-skal-aldri-vises"

    response = make_client(anthropic_api_key=secret).get("/healthz")

    assert response.json()["checks"]["anthropic_key"] == "set"
    assert secret not in response.text


@pytest.mark.parametrize("path", ["/v1/runs", "/v1/convert"])
def test_v1_rejects_a_request_without_token(client, path):
    response = client.post(path, json={})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(
    "authorization",
    ["Bearer feil-token", TOKEN, f"Basic {TOKEN}", f"bearer {TOKEN}", "Bearer "],
)
def test_v1_rejects_anything_but_the_exact_bearer_token(client, authorization):
    response = client.post("/v1/runs", json={}, headers={"Authorization": authorization})

    assert response.status_code == 401


def test_v1_with_token_reaches_the_unbuilt_endpoint(client, auth):
    response = client.post("/v1/convert", json={}, headers=auth)

    assert response.status_code == 501
    assert response.json()["error"]["code"] == "not_implemented"


def test_unknown_path_answers_in_the_contract_shape(client):
    response = client.get("/finnes-ikke")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_config_refuses_to_start_without_a_long_enough_token():
    with pytest.raises(ConfigError, match="INTERNAL_TOKEN"):
        Config.from_env({"INTERNAL_TOKEN": "for-kort"})


def test_config_fills_in_defaults_and_treats_blank_keys_as_missing():
    config = Config.from_env({"INTERNAL_TOKEN": TOKEN, "ANTHROPIC_API_KEY": "  "})

    assert config.anthropic_api_key is None
    assert config.anthropic_model == DEFAULT_MODEL
    assert config.search_url == "http://127.0.0.1:8081"
    assert (config.bind_host, config.bind_port) == ("127.0.0.1", 8082)


def test_config_rejects_a_bind_address_without_port():
    with pytest.raises(ConfigError, match="AGENT_BIND"):
        Config.from_env({"INTERNAL_TOKEN": TOKEN, "AGENT_BIND": "localhost"})
