-- Kunnskapsbasen: kategorier, guider og dokumenter.
--
-- Et dokument er både hjelpeartikkel og kilde for Lena. Standardverdiene
-- er utkast og intern: ingenting vises før noen har publisert det.
-- Denne filen endres aldri etter at den er kjørt. Nye endringer får ny fil.

CREATE TABLE kb_categories (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(120) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_kb_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE kb_guides (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id INT UNSIGNED NOT NULL,
    slug VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(200) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_kb_guides_slug (slug),
    CONSTRAINT fk_kb_guides_category FOREIGN KEY (category_id) REFERENCES kb_categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE kb_documents (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    uid CHAR(28) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    category_id INT UNSIGNED NOT NULL,
    guide_id INT UNSIGNED NULL,
    slug VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(300) NOT NULL DEFAULT '',
    markdown MEDIUMTEXT NOT NULL,
    content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    audience ENUM('public', 'customer', 'internal') NOT NULL DEFAULT 'internal',
    status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    sort_order INT NOT NULL DEFAULT 0,
    source ENUM('import', 'console', 'conversation') NOT NULL,
    source_ref VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_kb_documents_uid (uid),
    UNIQUE KEY uq_kb_documents_slug (slug),
    KEY ix_kb_documents_listing (category_id, status, audience, sort_order),
    CONSTRAINT fk_kb_documents_category FOREIGN KEY (category_id) REFERENCES kb_categories (id),
    CONSTRAINT fk_kb_documents_guide FOREIGN KEY (guide_id) REFERENCES kb_guides (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
