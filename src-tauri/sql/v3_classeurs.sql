-- Table des classeurs
CREATE TABLE IF NOT EXISTS classeurs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL DEFAULT 'Registre de Sécurité',
    icon       TEXT    NOT NULL DEFAULT 'BookOpen',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    DEFAULT CURRENT_TIMESTAMP
);

-- Insérer le classeur par défaut (reprend le nom de la préférence si elle existe)
INSERT INTO classeurs (id, name, sort_order)
SELECT 1,
       COALESCE((SELECT value FROM preferences WHERE key = 'registry_name'), 'Registre de Sécurité'),
       1;

-- Ajouter classeur_id aux chapitres existants (sans REFERENCES — limitation SQLite ALTER TABLE)
ALTER TABLE chapters ADD COLUMN classeur_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_chapters_classeur ON chapters(classeur_id);

-- Nettoyer la préférence devenue inutile
DELETE FROM preferences WHERE key = 'registry_name';
