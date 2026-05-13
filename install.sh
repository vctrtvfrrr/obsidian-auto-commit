#!/usr/bin/env bash
set -euo pipefail

VAULT="${1:-$HOME/obsidian}"
PLUGIN_ID="obsidian-auto-commit"
PKG="@vctrtvfrrr/${PLUGIN_ID}"
TARGET="${VAULT}/.obsidian/plugins/${PLUGIN_ID}"

mkdir -p "${TARGET}"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

cd "${TMP}"
npm pack "${PKG}"
tar -xzf ./*.tgz

cp package/manifest.json package/main.js "${TARGET}/"
[ -f package/styles.css ] && cp package/styles.css "${TARGET}/" || true

echo "Installed ${PKG} → ${TARGET}"
echo "Enable in Obsidian: Settings → Community plugins → Auto Commit"
