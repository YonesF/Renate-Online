import inspect
import json
from pathlib import Path

import anthropic
import pytest
from conftest import TOKEN
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from ca_agent import lena
from ca_agent.config import Config
from ca_agent.main import create_app

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
KNOWLEDGE = [
    {
        "document": "kd8ejkmcpqxot1uwisza345h769y",
        "slug": "dysesjekk",
        "title": "3. Dysesjekk",
        "text": "Kjør alltid dysesjekk før kundeordre.",
    }
]


def app(model=None, anthropic_api_key=None) -> TestClient:
    config = Config(
        internal_token=TOKEN,
        search_url="http://search.test",
        anthropic_api_key=anthropic_api_key,
        anthropic_model="claude-opus-5-5",
        bind_host="127.0.0.1",
        bind_port=0,
    )
    return TestClient(create_app(config, model=model))


def run(client: TestClient, text: str, **extra) -> list[dict]:
    body = {
        "run": "ruza345h769ybndrfg8ejkmcpqxo",
        "conversation": "coot1uwisza345h769ybndrfg8ej",
        "messages": [{"role": "visitor", "text": text, "at": "2026-11-15T10:42:07Z"}],
        "context": {"source": "help"},
        "audiences": ["public"],
        "locale": "nb_NO",
        "knowledge": KNOWLEDGE,
        **extra,
    }
    response = client.post("/v1/runs", json=body, headers=AUTH)
    assert response.status_code == 200
    return [json.loads(line) for line in response.text.splitlines() if line]


def test_a_run_streams_typing_then_text_then_done():
    events = run(app(lena.FakeModel()), "Hva gjør jeg når en farge mangler?")

    assert [event["type"] for event in events] == ["typing", "delta", "delta", "done"]
    assert "".join(e["text"] for e in events if e["type"] == "delta") == "Kjør en dysesjekk først."


def test_the_handover_marker_never_reaches_the_customer_even_split_across_chunks():
    events = run(app(lena.FakeModel()), "Hvor er ordren min? [handover]")

    text = "".join(e["text"] for e in events if e["type"] == "delta")
    assert "[[" not in text and "handover" not in text
    assert text.strip() == "Dette må en ansatt svare på."
    assert [e["type"] for e in events][-2:] == ["handover", "done"]


def test_a_model_failure_ends_the_stream_with_an_error_event():
    events = run(app(lena.FakeModel()), "[fail]")

    assert [event["type"] for event in events] == ["typing", "error"]
    assert events[-1]["code"] == "model_unavailable"


def test_without_a_key_the_run_answers_with_an_error_event_instead_of_crashing():
    events = run(app(model=None, anthropic_api_key=None), "Hei")

    assert events == [
        {"type": "error", "code": "model_unavailable", "message": "ANTHROPIC_API_KEY mangler."}
    ]


def test_every_event_follows_the_contract():
    schema = json.loads((CONTRACTS / "agent.run.event.schema.json").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)

    for text in ["Hei", "[handover]", "[fail]"]:
        for event in run(app(lena.FakeModel()), text):
            assert list(validator.iter_errors(event)) == [], event


def test_the_knowledge_is_in_the_system_prompt_and_the_context_in_the_user_turn():
    model = lena.FakeModel()
    context = {"source": "help", "page": {"url": "/x", "title": "3. Dysesjekk"}}

    run(app(model), "Hva betyr dette?", context=context)

    system, messages = model.calls[0]
    assert '<artikkel adresse="dysesjekk" tittel="3. Dysesjekk">' in system
    assert "Kjør alltid dysesjekk før kundeordre." in system
    assert "3. Dysesjekk" not in lena.INSTRUCTIONS
    assert messages[-1]["content"].startswith(
        "<kontekst>Kunden er på siden «3. Dysesjekk».</kontekst>"
    )
    assert "<kontekst>" not in system.replace(lena.INSTRUCTIONS, "")


def test_the_system_prompt_is_identical_for_the_same_knowledge_so_the_cache_hits():
    assert lena.system_prompt(KNOWLEDGE) == lena.system_prompt(list(KNOWLEDGE))


def test_history_becomes_alternating_turns_starting_with_the_customer():
    turns = lena.to_messages(
        [
            {"role": "lena", "text": "Hei!"},
            {"role": "visitor", "text": "A"},
            {"role": "visitor", "text": "B"},
            {"role": "lena", "text": "C"},
            {"role": "staff", "text": "D"},
            {"role": "visitor", "text": "E"},
        ],
        {},
    )

    assert turns == [
        {"role": "user", "content": "A\n\nB"},
        {"role": "assistant", "content": "C\n\nD"},
        {"role": "user", "content": "E"},
    ]


@pytest.mark.parametrize("body", [{}, {"messages": []}])
def test_an_invalid_run_request_is_rejected_in_the_contract_shape(body):
    response = app(lena.FakeModel()).post("/v1/runs", json=body, headers=AUTH)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_the_sdk_accepts_the_arguments_claude_model_passes():
    parameters = inspect.signature(
        anthropic.AsyncAnthropic(api_key="x").beta.messages.stream
    ).parameters

    for name in [
        "model",
        "max_tokens",
        "system",
        "messages",
        "output_config",
        "betas",
        "fallbacks",
    ]:
        assert name in parameters, name
