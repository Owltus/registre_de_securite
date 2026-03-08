/**
 * Synchronise la version dans tauri.conf.json et Cargo.toml
 * en lisant la version depuis package.json (source de vérité).
 *
 * Usage : node scripts/sync-version.mjs
 */
import { readFileSync, writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Lire la version depuis package.json (source de vérité)
const pkgPath = resolve(__dirname, "../package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
const version = pkg.version

// tauri.conf.json
const tauriPath = resolve(__dirname, "../src-tauri/tauri.conf.json")
const tauriConf = JSON.parse(readFileSync(tauriPath, "utf-8"))
tauriConf.version = version
writeFileSync(tauriPath, JSON.stringify(tauriConf, null, 2) + "\n")
console.log(`  tauri.conf.json → ${version}`)

// Cargo.toml
const cargoPath = resolve(__dirname, "../src-tauri/Cargo.toml")
let cargo = readFileSync(cargoPath, "utf-8")
cargo = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`)
writeFileSync(cargoPath, cargo)
console.log(`  Cargo.toml      → ${version}`)
