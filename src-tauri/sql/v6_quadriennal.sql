-- Ajout de la périodicité « Quadriennal » et colonne de tri sur periodicites
ALTER TABLE periodicites ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE periodicites SET sort_order = id WHERE id <= 6;
UPDATE periodicites SET sort_order = 8 WHERE id = 7;  -- Quinquennal → position 8
UPDATE periodicites SET sort_order = 9 WHERE id = 8;  -- Non défini → position 9

INSERT INTO periodicites (label, nombre, sort_order) VALUES ('Quadriennal', 4, 7);
