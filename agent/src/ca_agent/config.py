"""Alt agent trenger utenfra. Leses én gang ved oppstart."""

import os
from collections.abc import Mapping
from dataclasses import dataclass

MIN_TOKEN_LENGTH = 32
DEFAULT_MODEL = "claude-opus-5-5"


class ConfigError(RuntimeError):
    """Miljøet mangler noe tjenesten ikke kan starte uten."""


@dataclass(frozen=True)
class Config:
    internal_token: str
    search_url: str
    anthropic_api_key: str | None
    anthropic_model: str
    bind_host: str
    bind_port: int

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "Config":
        env = os.environ if env is None else env

        # Uten det interne tokenet ville /v1 stått åpent.
        token = env.get("INTERNAL_TOKEN", "")
        if len(token) < MIN_TOKEN_LENGTH:
            raise ConfigError(
                f"INTERNAL_TOKEN mangler eller er kortere enn {MIN_TOKEN_LENGTH} tegn"
            )

        bind = _value(env, "AGENT_BIND") or "127.0.0.1:8082"
        host, _, port = bind.rpartition(":")
        if not host or not port.isdigit():
            raise ConfigError(f"AGENT_BIND må være vert:port, fikk {bind!r}")

        return cls(
            internal_token=token,
            search_url=(_value(env, "SEARCH_URL") or "http://127.0.0.1:8081").rstrip("/"),
            anthropic_api_key=_value(env, "ANTHROPIC_API_KEY"),
            anthropic_model=_value(env, "ANTHROPIC_MODEL") or DEFAULT_MODEL,
            bind_host=host,
            bind_port=int(port),
        )


def _value(env: Mapping[str, str], name: str) -> str | None:
    return env.get(name, "").strip() or None
