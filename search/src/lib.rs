//! search: indeksering og hybrid søk for hjelpesiden og Lena.
//!
//! Skjelett. /healthz virker. Endepunktene under /v1 krever internt token
//! og svarer 501 til de bygges (steg 3 i docs/ARKITEKTUR.md).
//! Kontraktene ligger i ../contracts.

pub mod config;

use std::{sync::Arc, time::Duration};

use axum::{
    Json, Router,
    extract::{Request, State},
    http::{StatusCode, header::AUTHORIZATION},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde_json::{Value, json};

use config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .expect("HTTP-klienten kunne ikke bygges");

        Self {
            config: Arc::new(config),
            http,
        }
    }
}

pub fn app(state: AppState) -> Router {
    let v1 = Router::new()
        .route("/search", post(not_implemented))
        .route("/index", post(not_implemented))
        .route("/delete", post(not_implemented))
        .route("/rebuild", post(not_implemented))
        .route("/suggest", get(not_implemented))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            require_internal_token,
        ));

    Router::new()
        .route("/healthz", get(healthz))
        .nest("/v1", v1)
        .with_state(state)
}

async fn healthz(State(state): State<AppState>) -> Json<Value> {
    let qdrant = match state
        .http
        .get(format!("{}/healthz", state.config.qdrant_url))
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => "ok",
        _ => "unreachable",
    };
    let voyage_key = if state.config.voyage_api_key.is_some() {
        "set"
    } else {
        "missing"
    };

    Json(json!({
        "status": "ok",
        "service": "search",
        "version": env!("CARGO_PKG_VERSION"),
        "checks": {
            "qdrant": qdrant,
            "voyage_key": voyage_key,
            "voyage_model": state.config.voyage_model,
        }
    }))
}

async fn not_implemented() -> Response {
    error(
        StatusCode::NOT_IMPLEMENTED,
        "not_implemented",
        "Endepunktet er ikke bygd ennå.",
    )
}

async fn require_internal_token(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let presented = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));

    match presented {
        Some(token)
            if constant_time_eq(token.as_bytes(), state.config.internal_token.as_bytes()) =>
        {
            next.run(request).await
        }
        _ => error(
            StatusCode::UNAUTHORIZED,
            "unauthorized",
            "Mangler gyldig internt token.",
        ),
    }
}

/// Feilformen fra contracts/error.schema.json.
fn error(status: StatusCode, code: &str, message: &str) -> Response {
    (
        status,
        Json(json!({ "error": { "code": code, "message": message } })),
    )
        .into_response()
}

/// Sammenligner uten å avsløre hvor langt inn tokenet stemte.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::constant_time_eq;

    #[test]
    fn constant_time_eq_compares_content_and_length() {
        assert!(constant_time_eq(b"abc", b"abc"));
        assert!(!constant_time_eq(b"abc", b"abd"));
        assert!(!constant_time_eq(b"abc", b"abcd"));
        assert!(!constant_time_eq(b"", b"a"));
    }
}
