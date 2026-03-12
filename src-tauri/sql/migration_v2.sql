-- Migration v2 : UUID, soft delete et historique des merges

-- Ajouter uuid et deleted_at sur chapters
ALTER TABLE chapters ADD COLUMN uuid TEXT DEFAULT NULL;
ALTER TABLE chapters ADD COLUMN deleted_at TEXT DEFAULT NULL;

-- Ajouter uuid et deleted_at sur documents
ALTER TABLE documents ADD COLUMN uuid TEXT DEFAULT NULL;
ALTER TABLE documents ADD COLUMN deleted_at TEXT DEFAULT NULL;

-- Ajouter uuid et deleted_at sur tracking_sheets
ALTER TABLE tracking_sheets ADD COLUMN uuid TEXT DEFAULT NULL;
ALTER TABLE tracking_sheets ADD COLUMN deleted_at TEXT DEFAULT NULL;

-- Ajouter uuid et deleted_at sur signature_sheets
ALTER TABLE signature_sheets ADD COLUMN uuid TEXT DEFAULT NULL;
ALTER TABLE signature_sheets ADD COLUMN deleted_at TEXT DEFAULT NULL;

-- Ajouter uuid et deleted_at sur intercalaires
ALTER TABLE intercalaires ADD COLUMN uuid TEXT DEFAULT NULL;
ALTER TABLE intercalaires ADD COLUMN deleted_at TEXT DEFAULT NULL;

-- Générer des UUID pour toutes les lignes existantes
UPDATE chapters SET uuid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))) WHERE uuid IS NULL;
UPDATE documents SET uuid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))) WHERE uuid IS NULL;
UPDATE tracking_sheets SET uuid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))) WHERE uuid IS NULL;
UPDATE signature_sheets SET uuid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))) WHERE uuid IS NULL;
UPDATE intercalaires SET uuid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))) WHERE uuid IS NULL;

-- Table d'historique des merges (snapshot pour rollback)
CREATE TABLE IF NOT EXISTS merge_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    classeur_id   INTEGER NOT NULL,
    merged_at     TEXT    DEFAULT CURRENT_TIMESTAMP,
    source_name   TEXT    NOT NULL DEFAULT '',
    inserted      INTEGER NOT NULL DEFAULT 0,
    updated       INTEGER NOT NULL DEFAULT 0,
    unchanged     INTEGER NOT NULL DEFAULT 0,
    skipped       INTEGER NOT NULL DEFAULT 0,
    snapshot_json TEXT    NOT NULL DEFAULT ''
);
