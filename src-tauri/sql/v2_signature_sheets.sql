-- Feuilles de signature
CREATE TABLE IF NOT EXISTS signature_sheets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    chapter_id TEXT    NOT NULL DEFAULT '',
    nombre     INTEGER NOT NULL DEFAULT 14,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_signature_sheets_chapter ON signature_sheets(chapter_id);
