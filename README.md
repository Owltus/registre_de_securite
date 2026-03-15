# Registre

Application de bureau pour créer et gérer des **classeurs structurés** prêts à imprimer, organisés par chapitres avec une trame fixe.

Chaque classeur contient des chapitres, et chaque chapitre peut contenir des documents (Markdown), des feuilles de suivi périodique et des feuilles de signature — le tout exportable en PDF pour être classé dans un support physique.

## Fonctionnalités

- Multi-classeurs avec icône, nom et établissement personnalisables
- Chapitres personnalisables avec drag & drop
- Documents en Markdown (avec support Mermaid et KaTeX)
- Feuilles de suivi périodique et feuilles de signature
- Import de fichiers `.md` par glisser-déposer
- Export PDF (unitaire, par chapitre ou classeur complet avec sommaire)
- Thème clair / sombre
- Données stockées localement (SQLite)

## Installation

### Pré-requis

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Pré-requis Tauri v2 : voir [tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/)

### Lancer le projet

```bash
pnpm install
pnpm tauri dev
```

### Build de production

```bash
pnpm tauri build
```

## Licence

MIT
