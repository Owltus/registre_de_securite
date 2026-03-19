---
name: commit
description: Commit Git avec versioning semantique optionnel. Corrige ESLint, message Conventional Commits en francais, bumpp pour version/tag (si argument), et push.
disable-model-invocation: true
argument-hint: [patch|minor|major]
allowed-tools: Read, Edit, Bash(git:*), Bash(pnpm:*)
---

# Skill /commit - Commit avec Versioning Optionnel

Automatise le workflow: ESLint, commit, et optionnellement versioning via bumpp.

## Arguments

| Argument | Description | Exemple |
|----------|-------------|---------|
| *(vide)* | Commit seulement, pas de bump | - |
| `patch` | Commit + increment Z | 1.2.3 -> 1.2.4 |
| `minor` | Commit + increment Y, reset Z | 1.2.3 -> 1.3.0 |
| `major` | Commit + increment X, reset Y et Z | 1.2.3 -> 2.0.0 |

**Argument recu:** `$ARGUMENTS`

---

## Workflow

### Etape 1: Verifier les changements

```bash
git status
git diff --staged
git diff
```

- Si aucun changement (staging vide ET working tree clean): **STOP** avec message "Rien a commiter"
- Sinon: continuer

### Etape 2: Corriger ESLint

```bash
pnpm exec eslint --fix .
```

- Si erreurs restantes: les corriger manuellement avec Edit
- Si ESLint n'est pas installe: continuer sans (warning)

### Etape 3: Staging des fichiers

```bash
git add -A
```

Ou ajouter les fichiers specifiques si prefere.

### Etape 4: Generer le message de commit

Analyser les changements (`git diff --cached`) et generer un message **Conventional Commits**.

#### Types disponibles

| Type | Usage |
|------|-------|
| `feat` | nouvelle fonctionnalite |
| `fix` | correction de bug |
| `docs` | documentation |
| `style` | formatage, pas de changement de code |
| `refactor` | refactorisation |
| `perf` | amelioration performance |
| `test` | ajout/modification tests |
| `build` | systeme de build, dependances |
| `ci` | configuration CI |
| `chore` | maintenance, taches diverses |

#### Format complet

```
type(scope): sujet court (< 100 chars)

Description generale du changement en 1-2 phrases.
Expliquer le contexte et l'objectif.

- Detail du changement 1
- Detail du changement 2
- Detail du changement 3
- ...

Conclusion optionnelle sur l'impact ou les benefices.
```

#### Structure du message

| Partie | Obligatoire | Description |
|--------|-------------|-------------|
| Sujet | Oui | `type(scope): description` < 100 chars |
| Ligne vide | Oui | Separe le sujet du corps |
| Description | Oui | 1-2 phrases de contexte |
| Liste details | Oui | Bullet points des changements |
| Conclusion | Non | Impact/benefices (si pertinent) |

#### Regles

- **Francais** obligatoire
- **Minuscules** pour le type et le sujet
- **Pas de point final** sur le sujet
- **Sujet < 100 caracteres**
- Scope optionnel mais recommande
- **JAMAIS de "Co-Authored-By"** - Ne jamais ajouter cette ligne
- **Toujours un corps detaille** - Les commits simples c'est naze

#### Exemple complet

```
feat(cards): refactorisation des composants de cartes et mise a jour des exports

Ajout de nouveaux composants de cartes pour ameliorer la modularite
et la reutilisabilite dans l'application.

- Ajout des composants MaintenanceCard, WorkOrderCard,
  CategorieCard et SousCategorieCard
- Suppression de l'ancien composant WorkOrderCard
- Mise a jour des references dans les composants existants
- Reorganisation des exports dans index.ts
- Amelioration de l'integration dans les pages maintenance
  et planification

Cette refonte renforce la coherence des composants de cartes
et facilite leur reutilisation.
```

### Etape 5: Creer le commit

Utiliser un HEREDOC pour le message multi-lignes:

```bash
git commit -m "$(cat <<'EOF'
type(scope): sujet court

Description generale du changement.

- Detail 1
- Detail 2
- Detail 3

Conclusion si pertinent.
EOF
)"
```

**IMPORTANT:** Ne JAMAIS ajouter de ligne "Co-Authored-By".

### Etape 6: Bump de version avec bumpp (OPTIONNEL)

**Si `$ARGUMENTS` est vide:** SKIP cette etape, passer directement au push.

**Si `$ARGUMENTS` contient `patch`, `minor` ou `major`:** executer le bump.

#### 6a: Executer bumpp

```bash
pnpm run release:patch   # si $ARGUMENTS = "patch"
pnpm run release:minor   # si $ARGUMENTS = "minor"
pnpm run release:major   # si $ARGUMENTS = "major"
```

Cette commande (via bumpp) fait automatiquement:
- Met a jour les 3 fichiers de version (`package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`)
- Cree un commit "build: release vX.Y.Z"
- Cree le tag git vX.Y.Z

#### 6b: Regenerer Cargo.lock

```bash
cd src-tauri && cargo generate-lockfile
```

Cargo.toml a ete modifie par bumpp, il faut regenerer le lockfile sans recompiler.

#### 6c: Amender le commit bumpp avec Cargo.lock

```bash
git add src-tauri/Cargo.lock && git commit --amend --no-edit
```

Cela integre Cargo.lock dans le commit de release sans creer un commit supplementaire.

#### 6d: Recaler le tag sur le commit amende

L'amend a change le SHA du commit, mais le tag cree par bumpp pointe encore sur l'ancien SHA. Il faut le recreer sur HEAD:

```bash
# Recuperer le nom du tag (vX.Y.Z) depuis le dernier tag
TAG=$(git describe --tags --abbrev=0)
git tag -d "$TAG" && git tag "$TAG" HEAD
```

**IMPORTANT:** Cette etape est obligatoire apres l'amend. Sans elle, le tag pointe sur un commit orphelin et les workflows GitHub Actions (declenchement sur tag push) ne fonctionneront pas.

### Etape 7: Rapport final et push

#### 7a: Afficher le rapport

**Avec bump (argument patch/minor/major):**
```
Commit effectue:
- Message: type(scope): description
- Version: X.Y.Z -> X.Y.Z (via bumpp)
- Tag: vX.Y.Z
- Fichiers: N fichiers modifies
```

**Sans bump (pas d'argument):**
```
Commit effectue:
- Message: type(scope): description
- Version: non modifiee
- Tag: aucun
- Fichiers: N fichiers modifies
```

#### 7b: Demander confirmation pour le push

Demander a l'utilisateur : **"Push vers origin ? (oui/non)"**

- Si pas de remote configure: warning et skip le push
- Si l'utilisateur refuse: afficher "Push skipped"
- Si l'utilisateur accepte et **sans bump**: `git push origin HEAD`
- Si l'utilisateur accepte et **avec bump**: `git push origin HEAD && git push origin --tags --force`

---

## Gestion des erreurs

| Situation | Action |
|-----------|--------|
| Rien a commiter | Stop avec message |
| ESLint non installe | Warning, continuer |
| ESLint erreurs | Corriger manuellement |
| Pas d'argument | Commit sans bump (comportement normal) |
| Pas de package.json | Skip bumpp meme si argument fourni |
| bumpp echoue | Afficher erreur, le commit principal est deja fait |
| cargo generate-lockfile echoue | Afficher erreur, le commit bumpp est fait mais Cargo.lock pas a jour — corriger manuellement |
| Pas de remote | Warning, skip push |
| Push echoue | Afficher erreur |
