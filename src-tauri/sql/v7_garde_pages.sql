-- Pages de garde (intercalaires) rattachées aux chapitres
CREATE TABLE IF NOT EXISTS garde_pages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    description TEXT   NOT NULL DEFAULT '',
    chapter_id TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_garde_pages_chapter ON garde_pages(chapter_id);
