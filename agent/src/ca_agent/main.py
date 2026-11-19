"""HTTP-laget.

Skjelett. /healthz virker. Endepunktene under /v1 krever internt token og
svarer 501 til de bygges (steg 4 i docs/ARKITEKTUR.md). Kontraktene ligger
i ../contracts.
"""

import hmac
import json
from collections.abc import AsyncIterator
from typing import Annotated, Literal

import httpx2
from fastapi import APIRouter, Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from ca_agent import __version__, lena
from ca_agent.config import Config

_STATUS_CODES = {
    404: "not_found",
    405: "method_not_allowed",
}


class ApiError(Exception):
    """Gir feilformen fra contracts/error.schema.json."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def _error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


class Message(BaseModel):
    role: Literal["visitor", "lena", "staff"]
    text: str = Field(min_length=1, max_length=20000)
    at: str


class Article(BaseModel):
    document: str
    slug: str
    title: str
    text: str


class RunRequest(BaseModel):
    """contracts/agent.run.request.schema.json"""

    run: str
    conversation: str
    messages: list[Message] = Field(min_length=1, max_length=200)
    context: dict = Field(default_factory=dict)
    audiences: list[Literal["public", "customer", "internal"]] = Field(min_length=1)
    locale: Literal["nb_NO", "en_US"] = "nb_NO"
    knowledge: list[Article] = Field(default_factory=list, max_length=200)


def create_app(
    config: Config,
    search_transport: httpx2.AsyncBaseTransport | None = None,
    model: lena.Model | None = None,
) -> FastAPI:
    """Bygger appen. search_transport og model lar testene bytte ut search og Claude."""
    if model is None and config.anthropic_api_key:
        model = lena.ClaudeModel(config.anthropic_api_key, config.anthropic_model)
    app = FastAPI(
        title="ca-agent",
        version=__version__,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @app.exception_handler(ApiError)
    async def on_api_error(_: Request, error: ApiError) -> JSONResponse:
        return _error_response(error.status, error.code, error.message)

    @app.exception_handler(StarletteHTTPException)
    async def on_http_error(_: Request, error: StarletteHTTPException) -> JSONResponse:
        code = _STATUS_CODES.get(error.status_code, "http_error")
        return _error_response(error.status_code, code, str(error.detail))

    @app.exception_handler(RequestValidationError)
    async def on_invalid_request(_: Request, error: RequestValidationError) -> JSONResponse:
        first = error.errors()[0]
        where = ".".join(str(part) for part in first["loc"])
        return _error_response(422, "invalid_request", f"{where}: {first['msg']}")

    def require_internal_token(
        authorization: Annotated[str | None, Header()] = None,
    ) -> None:
        scheme, _, token = (authorization or "").partition(" ")
        expected = config.internal_token.encode()
        if scheme != "Bearer" or not hmac.compare_digest(token.encode(), expected):
            raise ApiError(401, "unauthorized", "Mangler gyldig internt token.")

    async def search_status() -> str:
        try:
            async with httpx2.AsyncClient(transport=search_transport, timeout=2.0) as client:
                response = await client.get(f"{config.search_url}/healthz")
        except httpx2.HTTPError:
            return "unreachable"
        return "ok" if response.is_success else "unreachable"

    @app.get("/healthz")
    async def healthz() -> dict[str, object]:
        return {
            "status": "ok",
            "service": "agent",
            "version": __version__,
            "checks": {
                "search": await search_status(),
                "anthropic_key": "set" if config.anthropic_api_key else "missing",
                "anthropic_model": config.anthropic_model,
            },
        }

    v1 = APIRouter(prefix="/v1", dependencies=[Depends(require_internal_token)])

    @v1.post("/runs")
    async def runs(request: RunRequest) -> StreamingResponse:
        async def events() -> AsyncIterator[str]:
            if model is None:
                # Uten nøkkel svarer vi i strømmen, slik at web kan overlevere.
                unavailable = {
                    "type": "error",
                    "code": "model_unavailable",
                    "message": "ANTHROPIC_API_KEY mangler.",
                }
                yield json.dumps(unavailable, ensure_ascii=False) + "\n"
                return

            system = lena.system_prompt([article.model_dump() for article in request.knowledge])
            messages = lena.to_messages(
                [message.model_dump() for message in request.messages],
                request.context,
            )
            async for event in lena.run(model, system, messages):
                yield json.dumps(event, ensure_ascii=False) + "\n"

        return StreamingResponse(events(), media_type="application/x-ndjson")

    @v1.post("/convert")
    async def convert() -> None:
        raise ApiError(501, "not_implemented", "Endepunktet er ikke bygd ennå.")

    app.include_router(v1)
    return app
