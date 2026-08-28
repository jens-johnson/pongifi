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
# ████████████████████████████████████████ scripts/shell/run-wrapped-command.sh ████████████████████████████████████████
#
# Shared wrapper core: rejects npm/npx, validates the Node version, then execs the first real binary on PATH.
#
# ─── USAGE ────────────────────────────────────────────────────────────────────────────────────────────────────────────
#
# Exec'd by the bin/wrappers/ shims; not invoked directly.
#
# ██████████████████████████████████████████████████████████████████████████████████████████████████████████████████████

# ─── Setup ────────────────────────────────────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Resolve the repo root relative to this script so it runs from any working directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# The wrapper shim directory; the real binary is the first PATH match outside it
WRAPPER_DIRECTORY="$REPO_ROOT/bin/wrappers"

# The wrapped command name, forwarded by the bin/wrappers/ shim
COMMAND_NAME="${1:?usage: run-wrapped-command.sh <command> [args...]}"
shift




# ─── Guard Rails ──────────────────────────────────────────────────────────────────────────────────────────────────────

# npm and npx are rejected outright; this repo pins pnpm via Corepack and a stray npm install would litter it with a
# package-lock.json and an unpinned dependency tree
case "$COMMAND_NAME" in
  npm | npx)
    echo -e "\033[0;31merror: this repo uses pnpm (Corepack-pinned). Use \033[0m\033[1;31mpnpm\033[0m\033[0;31m instead of ${COMMAND_NAME}.\033[0m" >&2
    exit 1
    ;;
esac

# Validate the shell's Node version before running anything that depends on it
"$REPO_ROOT/scripts/shell/validate-node-version.sh" >/dev/null




# ─── Dispatch ─────────────────────────────────────────────────────────────────────────────────────────────────────────

# Exec the first real binary on PATH that is not one of these wrappers; skipping by directory (rather than stripping a
# PATH entry) cannot recurse back into the shim
while IFS= read -r candidate; do
  candidate_directory="$(cd "$(dirname "$candidate")" && pwd)"
  if [ "$candidate_directory" != "$WRAPPER_DIRECTORY" ]; then
    exec "$candidate" "$@"
  fi
done < <(type -aP "$COMMAND_NAME")

echo -e "\033[0;31merror: no real ${COMMAND_NAME} found on PATH.\033[0m" >&2
exit 127
