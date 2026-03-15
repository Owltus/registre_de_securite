# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Registre** est une application de bureau (Windows/macOS/Linux) pour créer et gérer des classeurs structurés prêts à imprimer, organisés par chapitres avec une trame fixe. Basée sur un boilerplate Tauri v2.

## Stack

- **Framework:** Tauri v2
- **Backend:** Rust (stable)
- **Frontend:** React 18+ / TypeScript, Vite bundler
- **UI:** shadcn/ui (Radix UI) + Tailwind CSS v3
- **Routing:** React Router v6 with lazy loading
- **Local DB:** SQLite via tauri-plugin-sql
- **Theme:** CSS custom properties (implémentation manuelle), dark class on `<html>`

## Architecture (from PRDs)

The project is spec'd across PRD documents in the repo root. Key architectural decisions:

**Navigation (PRD-01):** Responsive layout — sidebar on desktop (breakpoint `lg`), drawer menu on mobile. Layout detection is automatic via screen width, no manual toggle. A central config array defines all nav items; adding a page = adding a route + an entry in that array. Settings and About are in a modal dialog accessible from the sidebar.

**Theme (PRD-02):** Light/dark via CSS custom properties following shadcn/ui token conventions. Preference stored in SQLite `preferences` table. First launch detects OS `prefers-color-scheme`; manual choice overrides it persistently.

**Data layer (PRD-03):** Two-tier storage — SQLite local (always on) + optional external DB (Postgres/MySQL via Rust drivers). A `DataAdapter` interface abstracts both behind `useQuery`, `useMutation`, and `usePreference` hooks. Frontend never calls SQLite directly. Migrations run automatically at startup.

**Rust backend (PRD-05):** All system access goes through typed Tauri commands. Unified `AppError` enum (thiserror + serde) propagated to React. Shared `AppState` holds DB connection and config behind `Mutex`. Plugins: tauri-plugin-sql, tauri-plugin-fs, tauri-plugin-dialog, tauri-plugin-shell.

## Target File Structure

```
src/
├── layouts/          # RootLayout (unique layout: titlebar + sidebar + content)
├── components/       # Sidebar (desktop fixe + mobile drawer), NavItem
├── features/
│   └── settings/     # SettingsDialog (Apparence + À propos)
├── pages/            # Chaque page a son propre dossier
│   ├── home/         # Page d'accueil
│   └── dashboard/    # Tableau de bord
├── lib/
│   ├── db/           # DataAdapter, sqlite.ts, external.ts, migrations/
│   ├── hooks/        # useQuery, useMutation, usePreference
│   └── theme.ts
└── styles/
    └── globals.css   # CSS custom properties for both themes

src-tauri/
└── src/
    ├── main.rs       # Entry point, command registration
    ├── lib.rs        # App setup, plugins, state init
    ├── state.rs      # AppState (db + config behind Mutex)
    ├── error.rs      # AppError enum
    └── commands/     # mod.rs, app.rs, files.rs
```

## Development Commands

```bash
# Lancer l'app en mode développement (frontend + backend)
pnpm tauri dev

# Build frontend seul (TypeScript check + Vite)
pnpm build

# Build backend Rust seul
cd src-tauri && cargo build

# Lint frontend
pnpm lint

# Générer les icônes depuis un PNG source
pnpm tauri icon app-icon.png
```

## Adding a New Page

1. Créer le dossier `src/pages/ma-page/` et y placer `MaPage.tsx`
2. Ajouter l'entrée dans `src/lib/navigation.ts`
3. Ajouter la route lazy dans `src/App.tsx` (import depuis `@/pages/ma-page/MaPage`)

## Adding a New Tauri Command

1. Créer ou modifier un fichier dans `src-tauri/src/commands/`
2. Exporter le module dans `src-tauri/src/commands/mod.rs`
3. Enregistrer la commande dans `src-tauri/src/lib.rs` → `generate_handler![]`
4. Si un plugin est nécessaire, ajouter la permission dans `src-tauri/capabilities/default.json`

## Conventions

- Language: French for user-facing text and comments
- Every Tauri command must have `///` doc comments, explicit error handling, and return `Result<T, AppError>`
- No direct system calls from React — everything goes through Rust commands
- Each feature is optional and removable without breaking others
