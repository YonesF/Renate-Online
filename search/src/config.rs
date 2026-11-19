use std::env;

/// Alt search trenger utenfra. Leses én gang ved oppstart.
#[derive(Clone, Debug)]
pub struct Config {
    pub bind: String,
    pub qdrant_url: String,
    pub internal_token: String,
    pub voyage_api_key: Option<String>,
    pub voyage_model: String,
}

impl Config {
    pub const MIN_TOKEN_LENGTH: usize = 32;

    /// Feiler hvis det interne tokenet mangler. Uten det ville /v1 stått åpent.
    pub fn from_env() -> Result<Self, String> {
        let internal_token = env::var("INTERNAL_TOKEN").unwrap_or_default();
        if internal_token.len() < Self::MIN_TOKEN_LENGTH {
            return Err(format!(
                "INTERNAL_TOKEN mangler eller er kortere enn {} tegn",
                Self::MIN_TOKEN_LENGTH
            ));
        }

        Ok(Self {
            bind: var_or("SEARCH_BIND", "127.0.0.1:8081"),
            qdrant_url: var_or("QDRANT_URL", "http://127.0.0.1:6333"),
            internal_token,
            voyage_api_key: env::var("VOYAGE_API_KEY")
                .ok()
                .filter(|key| !key.trim().is_empty()),
            voyage_model: var_or("VOYAGE_MODEL", "voyage-4"),
        })
    }
}

fn var_or(name: &str, fallback: &str) -> String {
    env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| fallback.to_owned())
}
