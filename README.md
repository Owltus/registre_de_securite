# Registre

Application portable pour constituer et maintenir des **classeurs réglementaires** structurés par chapitres, prêts à imprimer. Pensée pour les registres de sécurité, carnets sanitaires et archives techniques liés aux ERP.

Aucune installation requise — un seul exécutable, vos données restent en local.

## Pourquoi Registre

Gérer un registre de sécurité ou un carnet sanitaire implique de maintenir des dizaines de documents, fiches de suivi et feuilles d'émargement, souvent répartis dans des classeurs physiques. Registre centralise tout dans une interface unique : vous structurez, vous imprimez, vous archivez.

## Fonctionnalités

**Organisation**
- Multi-classeurs avec chapitres personnalisables
- Documents enrichis (tableaux, formules mathématiques, diagrammes)
- Feuilles de suivi périodique (mensuel, semestriel, annuel...)
- Feuilles de signature / émargement
- Intercalaires de séparation
- Réorganisation par glisser-déposer entre chapitres

**Import / Export**
- Import de documents par glisser-déposer
- Export PDF complet avec page de garde et sommaire
- Export PDF unitaire par document ou chapitre
- Sauvegarde et restauration du classeur au format JSON
- Export Markdown (archive ZIP)

**Productivité**
- Recherche instantanée dans tout le classeur
- Historique des imports avec rollback
- Prévisualisation avant impression
- Données 100% locales, aucun compte requis

## Utilisation

### Version portable (recommandé)

Téléchargez `registre.exe` depuis la [dernière release](https://github.com/Owltus/Registre/releases/latest), lancez-le, c'est prêt.

### Depuis les sources

Pré-requis : [Node.js](https://nodejs.org/) >= 18, [pnpm](https://pnpm.io/), [Rust](https://www.rust-lang.org/tools/install) stable et les [dépendances Tauri v2](https://v2.tauri.app/start/prerequisites/).

```bash
pnpm install
pnpm tauri dev
```

Build de production :

```bash
pnpm tauri build
```

## Stack technique

Tauri v2 · React · TypeScript · SQLite · Tailwind CSS

## Licence

Ce projet est distribué sous licence **Propriétaire Source-Available** — voir [LICENSE](LICENSE).

**Usages autorisés sans licence :** usage personnel, associations loi 1901 et établissements d'enseignement.

**Usage commercial :** toute utilisation professionnelle, en entreprise ou dans une administration non éducative nécessite l'obtention d'une licence commerciale.

Contact : pl.bessonneau@gmail.com
