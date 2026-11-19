use std::process::ExitCode;

use search::{AppState, app, config::Config};

#[tokio::main]
async fn main() -> ExitCode {
    let config = match Config::from_env() {
        Ok(config) => config,
        Err(message) => {
            eprintln!("search: {message}");
            return ExitCode::from(2);
        }
    };

    let bind = config.bind.clone();
    let listener = match tokio::net::TcpListener::bind(&bind).await {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("search: kan ikke lytte på {bind}: {error}");
            return ExitCode::from(2);
        }
    };
    eprintln!("search lytter på {bind}");

    let served = axum::serve(listener, app(AppState::new(config)))
        .with_graceful_shutdown(shutdown())
        .await;

    match served {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("search: serveren stoppet med feil: {error}");
            ExitCode::FAILURE
        }
    }
}

/// Ctrl+C lokalt, SIGTERM i en container.
async fn shutdown() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};

        let mut terminate = signal(SignalKind::terminate()).expect("kunne ikke lytte på SIGTERM");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = terminate.recv() => {}
        }
    }

    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
