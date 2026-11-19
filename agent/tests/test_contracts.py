"""Kontraktene i ../contracts er felles for web, search og agent.

Her sjekkes at skjemaene er gyldige, at hvert eksempel passer skjemaet
sitt, og at feilene agent faktisk sender, har den avtalte formen.
"""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
SCHEMAS = sorted(CONTRACTS.glob("*.schema.json"))
EXAMPLES = sorted((CONTRACTS / "examples").glob("*.json"))


def load(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def schema_for(example: Path) -> Path:
    """search.search.request.help.json hører til search.search.request.schema.json."""
    name, _case = example.stem.rsplit(".", 1)
    return CONTRACTS / f"{name}.schema.json"


def validator(schema_path: Path) -> Draft202012Validator:
    return Draft202012Validator(load(schema_path))


def test_the_contracts_folder_is_found():
    assert SCHEMAS, f"fant ingen skjemaer i {CONTRACTS}"
    assert EXAMPLES, f"fant ingen eksempler i {CONTRACTS / 'examples'}"


@pytest.mark.parametrize("schema_path", SCHEMAS, ids=lambda path: path.name)
def test_schema_is_valid_json_schema(schema_path):
    Draft202012Validator.check_schema(load(schema_path))


@pytest.mark.parametrize("schema_path", SCHEMAS, ids=lambda path: path.name)
def test_schema_has_at_least_one_example(schema_path):
    assert any(schema_for(example) == schema_path for example in EXAMPLES)


@pytest.mark.parametrize("example", EXAMPLES, ids=lambda path: path.name)
def test_example_matches_its_schema(example):
    schema_path = schema_for(example)
    assert schema_path.exists(), f"{example.name} har ikke noe skjema"

    errors = [error.message for error in validator(schema_path).iter_errors(load(example))]

    assert errors == []


def test_the_run_event_schema_rejects_an_unknown_event():
    events = validator(CONTRACTS / "agent.run.event.schema.json")

    assert not events.is_valid({"type": "delta"})
    assert not events.is_valid({"type": "ukjent"})


def test_the_search_request_schema_rejects_an_unknown_audience():
    requests = validator(CONTRACTS / "search.search.request.schema.json")

    assert not requests.is_valid({"collection": "kb", "query": "vinyl", "audiences": ["alle"]})
    assert not requests.is_valid({"collection": "kb", "query": "vinyl", "audiences": []})


@pytest.mark.parametrize(
    ("method", "path", "use_token"),
    [
        ("POST", "/v1/runs", False),
        ("POST", "/v1/convert", True),
        ("GET", "/finnes-ikke", False),
        ("GET", "/v1/runs", True),
    ],
)
def test_errors_from_the_app_follow_the_error_contract(client, auth, method, path, use_token):
    response = client.request(method, path, headers=auth if use_token else {})

    assert response.status_code >= 400
    errors = validator(CONTRACTS / "error.schema.json")
    assert list(errors.iter_errors(response.json())) == []
