-- Ajout des colonnes établissement au classeur
ALTER TABLE classeurs ADD COLUMN etablissement TEXT NOT NULL DEFAULT '';
ALTER TABLE classeurs ADD COLUMN etablissement_complement TEXT NOT NULL DEFAULT '';
