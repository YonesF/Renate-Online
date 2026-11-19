-- Samtaler med Lena.
--
-- Besøkende er ikke brukere. En samtale hører til et enhetstoken, og bare
-- en HMAC av tokenet lagres. Denne filen endres aldri etter at den er kjørt.

CREATE TABLE conversations (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    uid CHAR(28) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    visitor_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status ENUM('open', 'waiting') NOT NULL DEFAULT 'open',
    source ENUM('shop', 'help') NOT NULL DEFAULT 'help',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_conversations_uid (uid),
    UNIQUE KEY uq_conversations_visitor (visitor_hash),
    KEY ix_conversations_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE messages (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    uid CHAR(28) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    conversation_id INT UNSIGNED NOT NULL,
    role ENUM('visitor', 'lena', 'staff') NOT NULL,
    text MEDIUMTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_messages_uid (uid),
    KEY ix_messages_conversation (conversation_id, id),
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE rate_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    bucket CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_rate_events_bucket (bucket, created_at)
) ENGINE=InnoDB;
