use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode, header::AUTHORIZATION},
};
use http_body_util::BodyExt;
use search::{AppState, app, config::Config};
use serde_json::Value;
use tower::ServiceExt;

const TOKEN: &str = "test-token-0123456789-0123456789-0123456789";

fn test_app() -> Router {
    app(AppState::new(Config {
        bind: "127.0.0.1:0".into(),
        // Port 9 har ingen lytter, så Qdrant-sjekken skal gi «unreachable».
        qdrant_url: "http://127.0.0.1:9".into(),
        internal_token: TOKEN.into(),
        voyage_api_key: None,
        voyage_model: "voyage-4".into(),
    }))
}

async fn send(request: Request<Body>) -> (StatusCode, Value) {
    let response = test_app()
        .oneshot(request)
        .await
        .expect("ruteren svarte ikke");
    let status = response.status();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("kunne ikke lese svaret")
        .to_bytes();
    let body = serde_json::from_slice(&bytes).expect("svaret var ikke JSON");
    (status, body)
}

fn search_request(authorization: Option<&str>) -> Request<Body> {
    let mut builder = Request::post("/v1/search").header("content-type", "application/json");
    if let Some(value) = authorization {
        builder = builder.header(AUTHORIZATION, value);
    }
    builder
        .body(Body::from(
            r#"{"collection":"kb","query":"vinyl","audiences":["public"]}"#,
        ))
        .expect("ugyldig testforespørsel")
}

#[tokio::test]
async fn healthz_answers_without_token_and_reports_its_dependencies() {
    let (status, body) = send(Request::get("/healthz").body(Body::empty()).unwrap()).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    assert_eq!(body["service"], "search");
    assert_eq!(body["checks"]["qdrant"], "unreachable");
    assert_eq!(body["checks"]["voyage_key"], "missing");
    assert_eq!(body["checks"]["voyage_model"], "voyage-4");
}

#[tokio::test]
async fn v1_rejects_a_request_without_token() {
    let (status, body) = send(search_request(None)).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["code"], "unauthorized");
}

#[tokio::test]
async fn v1_rejects_a_wrong_token() {
    let (status, body) = send(search_request(Some("Bearer feil-token"))).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["code"], "unauthorized");
}

#[tokio::test]
async fn v1_rejects_the_token_without_the_bearer_scheme() {
    let (status, _) = send(search_request(Some(TOKEN))).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn v1_with_token_reaches_the_unbuilt_endpoint() {
    let (status, body) = send(search_request(Some(&format!("Bearer {TOKEN}")))).await;

    assert_eq!(status, StatusCode::NOT_IMPLEMENTED);
    assert_eq!(body["error"]["code"], "not_implemented");
}

#[tokio::test]
async fn suggest_is_guarded_like_the_rest_of_v1() {
    let (status, _) = send(
        Request::get("/v1/suggest?q=vin")
            .body(Body::empty())
            .unwrap(),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
}
