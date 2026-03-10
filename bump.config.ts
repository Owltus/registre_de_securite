export default {
  commit: "build: release v%s",
  tag: "v%s",
  push: false,
  all: true,
  execute: "cargo generate-lockfile --manifest-path src-tauri/Cargo.toml",
  files: [
    "package.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
  ],
}
