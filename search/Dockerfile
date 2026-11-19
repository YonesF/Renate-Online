# dev: verktøykjeden med clippy og rustfmt. Brukes av search-dev i docker-compose.yml.
FROM rust:1.100-slim-trixie AS dev
RUN rustup component add clippy rustfmt
WORKDIR /src

FROM dev AS build
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

FROM debian:trixie-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/search /usr/local/bin/search

USER nobody
ENV SEARCH_BIND=0.0.0.0:8081
EXPOSE 8081
CMD ["search"]
