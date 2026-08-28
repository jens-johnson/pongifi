#!/usr/bin/env bash
# ██████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
#
#                                  ██████╗  ██████╗ ███╗   ██╗ ██████╗ ██╗███████╗██╗
#                                  ██╔══██╗██╔═══██╗████╗  ██║██╔════╝ ██║██╔════╝██║
#                                  ██████╔╝██║   ██║██╔██╗ ██║██║  ███╗██║█████╗  ██║
#                                  ██╔═══╝ ██║   ██║██║╚██╗██║██║   ██║██║██╔══╝  ██║
#                                  ██║     ╚██████╔╝██║ ╚████║╚██████╔╝██║██║     ██║
#                                  ╚═╝      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝     ╚═╝
#
# ██████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
# ████████████████████████████████████████ scripts/shell/update-dependencies.sh ████████████████████████████████████████
#
# Installs dependencies when node_modules is missing or the lockfile is newer than the last pnpm install.
#
# ─── USAGE ────────────────────────────────────────────────────────────────────────────────────────────────────────────
#
# Runs automatically via the shell init; invoke manually with `bash scripts/shell/update-dependencies.sh`.
#
# ██████████████████████████████████████████████████████████████████████████████████████████████████████████████████████

# ─── Setup ────────────────────────────────────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Resolve the repo root relative to this script so it runs from any working directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"




# ─── Package Manager ──────────────────────────────────────────────────────────────────────────────────────────────────

# pnpm ships through Corepack (the packageManager field pins the exact version); activate it if it is not on PATH yet
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    echo -e "\033[0;33mpnpm is not on PATH; enabling it via Corepack...\033[0m" >&2
    corepack enable
  else
    echo -e "\033[0;31merror: neither pnpm nor corepack is available. Install Node (which bundles Corepack) and retry.\033[0m" >&2
    exit 1
  fi
fi




# ─── Dependencies ─────────────────────────────────────────────────────────────────────────────────────────────────────

echo -e "📦  Checking dependency freshness..." >&2

# pnpm rewrites node_modules/.modules.yaml on every install, so it doubles as the last-install marker; reinstall when
# it is missing or the lockfile has changed since
INSTALL_MARKER="$REPO_ROOT/node_modules/.modules.yaml"
if [ ! -f "$INSTALL_MARKER" ] || [ "$REPO_ROOT/pnpm-lock.yaml" -nt "$INSTALL_MARKER" ]; then
  echo -e "\033[0;33mDependencies are stale (lockfile is newer than the last install). Installing...\033[0m" >&2
  pnpm --dir "$REPO_ROOT" install
fi
