#!/usr/bin/env bash
# █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
#
#                                  ██████╗  ██████╗ ███╗   ██╗ ██████╗ ██╗███████╗██╗
#                                  ██╔══██╗██╔═══██╗████╗  ██║██╔════╝ ██║██╔════╝██║
#                                  ██████╔╝██║   ██║██╔██╗ ██║██║  ███╗██║█████╗  ██║
#                                  ██╔═══╝ ██║   ██║██║╚██╗██║██║   ██║██║██╔══╝  ██║
#                                  ██║     ╚██████╔╝██║ ╚████║╚██████╔╝██║██║     ██║
#                                  ╚═╝      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝     ╚═╝
#
# █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
# ██████████████████████████████████████ scripts/shell/validate-node-version.sh ███████████████████████████████████████
#
# Validates the shell's Node version against the repo-root .nvmrc pin; a prefix match, needing no nvm and no network.
#
# ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
#
# Runs via direnv and the command wrappers; invoke manually with `bash scripts/shell/validate-node-version.sh`.
#
# ─── RETURNS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
#
# • The resolved Node version on stdout when the pin is satisfied; exit 1 with remediation guidance on stderr otherwise
#
# ─── SEE ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
#
#   • https://github.com/nvm-sh/nvm
#
# █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████

# ─── Setup ───────────────────────────────────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Resolve the repo root relative to this script so it runs from any working directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# The pinned Node version lives in the repo-root .nvmrc
NVMRC_PATH="$REPO_ROOT/.nvmrc"




# ─── Version Check ───────────────────────────────────────────────────────────────────────────────────────────────────

# A missing pin is a repo defect, not an environment defect; fail loudly
if [ ! -f "$NVMRC_PATH" ]; then
  echo -e "\033[0;31merror: no .nvmrc found at ${NVMRC_PATH}; pin a Node version first.\033[0m" >&2
  exit 1
fi

# Normalize the pin (strip a leading v and whitespace) and read the shell's current Node version
PINNED_NODE_VERSION="$(tr -d 'v[:space:]' < "$NVMRC_PATH")"
CURRENT_NODE_VERSION="$(node -v 2>/dev/null || true)"

if [ -z "$CURRENT_NODE_VERSION" ]; then
  echo -e "\033[0;31merror: node is not on PATH. Install it (nvm install ${PINNED_NODE_VERSION}) and retry.\033[0m" >&2
  exit 1
fi

# Prefix-match the pin so a bare major (24) or major.minor accepts any current version beneath it; this needs no nvm
# and no network, so it stays instant on every shell entry and wrapped command
case "$CURRENT_NODE_VERSION" in
  "v${PINNED_NODE_VERSION}" | "v${PINNED_NODE_VERSION}".*)
    # The resolved version is the script's payload; callers capture it from stdout
    echo "$CURRENT_NODE_VERSION"
    ;;
  *)
    echo -e "\033[1;31m✗ Node version mismatch\033[0m" >&2
    echo -e "\033[4;31mExpected (.nvmrc)\033[0m\033[0;31m:\033[0m \033[1;31mv${PINNED_NODE_VERSION}\033[0m" >&2
    echo -e "\033[4;31mCurrent shell\033[0m\033[0;31m:\033[0m \033[1;31m${CURRENT_NODE_VERSION}\033[0m" >&2
    echo -e "\033[0;31mSwitch with \033[0m\033[1;31mnvm use\033[0m\033[0;31m (or install with \033[0m\033[1;31mnvm install ${PINNED_NODE_VERSION}\033[0m\033[0;31m) and retry.\033[0m" >&2
    exit 1
    ;;
esac
