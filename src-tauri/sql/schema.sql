-- Schema initial — Registre

-- Préférences utilisateur (thème, etc.)
CREATE TABLE IF NOT EXISTS preferences (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Documents rattachés aux chapitres
CREATE TABLE IF NOT EXISTS documents (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    content    TEXT    NOT NULL DEFAULT '',
    chapter_id TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_chapter ON documents(chapter_id);

-- Périodicités de suivi
CREATE TABLE IF NOT EXISTS periodicites (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    label      TEXT    NOT NULL,
    nombre     INTEGER NOT NULL DEFAULT 8,
    sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO periodicites (label, nombre, sort_order) VALUES
    ('Mensuel', 8, 1),
    ('Sesquimestriel', 8, 2),
    ('Semestriel', 8, 3),
    ('Annuel', 8, 4),
    ('Biennale', 8, 5),
    ('Triennal', 4, 6),
    ('Quadriennal', 4, 7),
    ('Quinquennal', 4, 8),
    ('Non défini', 8, 9);

-- Feuilles de suivi
CREATE TABLE IF NOT EXISTS tracking_sheets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,
    chapter_id      TEXT    NOT NULL DEFAULT '',
    periodicite_id  INTEGER NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (periodicite_id) REFERENCES periodicites(id)
);
CREATE INDEX IF NOT EXISTS idx_tracking_sheets_chapter ON tracking_sheets(chapter_id);

-- Chapitres du registre ERP
CREATE TABLE IF NOT EXISTS chapters (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT    NOT NULL,
    icon        TEXT    NOT NULL DEFAULT 'FileText',
    description TEXT    NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    DEFAULT CURRENT_TIMESTAMP
);

-- Chapitres par défaut
INSERT INTO chapters (label, icon, description, sort_order) VALUES
    ('Informations générales',    'Building2',      'Identité de l''établissement, classement ERP, coordonnées et informations administratives.', 1),
    ('Vérifications périodiques', 'ClipboardCheck', 'Rapports de vérifications techniques réglementaires (électricité, gaz, ascenseurs, etc.).', 2),
    ('Moyens de secours',         'ShieldAlert',    'Inventaire et maintenance des équipements de sécurité (extincteurs, alarmes, désenfumage, etc.).', 3),
    ('Formation du personnel',    'GraduationCap',  'Attestations de formation sécurité incendie, exercices d''évacuation et habilitations.', 4),
    ('Travaux',                   'Wrench',         'Suivi des travaux réalisés ou en cours impactant la sécurité de l''établissement.', 5),
    ('Observations',              'Eye',            'Remarques, anomalies constatées et actions correctives à mener.', 6),
    ('Consignes de sécurité',     'ScrollText',     'Consignes générales et particulières de sécurité, plans d''évacuation et procédures.', 7),
    ('Commissions de sécurité',   'Users',          'Procès-verbaux des commissions de sécurité et suivi des prescriptions.', 8);
