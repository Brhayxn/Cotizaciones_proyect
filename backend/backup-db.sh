#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
BACKEND_DIR="${SCRIPT_PATH%/*}"
if [[ "$BACKEND_DIR" == "$SCRIPT_PATH" ]]; then
  BACKEND_DIR="."
fi
cd "$BACKEND_DIR"

node scripts/backup-database.js
