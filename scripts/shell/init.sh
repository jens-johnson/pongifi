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
# ███████████████████████████████████████████████ scripts/shell/init.sh ████████████████████████████████████████████████
#
# Shell environment initialization: banner, Node validation, dependency freshness, and a status readout.
#
# ─── USAGE ────────────────────────────────────────────────────────────────────────────────────────────────────────────
#
# Runs automatically via direnv on shell entry; invoke manually with `bash scripts/shell/init.sh`.
#
# ─── SEE ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
#
#   • https://direnv.net/
#
# ██████████████████████████████████████████████████████████████████████████████████████████████████████████████████████

# ─── Setup ────────────────────────────────────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# The display label for status output; the only line to edit when copying this template into another repo
PROJECT_LABEL="pongifi"

# Resolve the repo root relative to this script so it runs from any working directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Print the project banner
echo -e "\033[1;32m"
cat <<'BANNER'
  ██████╗  ██████╗ ███╗   ██╗ ██████╗ ██╗███████╗██╗
  ██╔══██╗██╔═══██╗████╗  ██║██╔════╝ ██║██╔════╝██║
  ██████╔╝██║   ██║██╔██╗ ██║██║  ███╗██║█████╗  ██║
  ██╔═══╝ ██║   ██║██║╚██╗██║██║   ██║██║██╔══╝  ██║
  ██║     ╚██████╔╝██║ ╚████║╚██████╔╝██║██║     ██║
  ╚═╝      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝     ╚═╝
BANNER
echo -e "\033[0m"
echo -e "\033[1;32m${PROJECT_LABEL}\033[0m || 🐚  Setting up your shell environment..."




# ─── Node Version ─────────────────────────────────────────────────────────────────────────────────────────────────────

# Validate the shell's Node version against .nvmrc, capturing the resolved version for the status output; a mismatch
# warns here (the wrappers hard-block later) so shell entry itself never fails
NODE_VERSION="$("$REPO_ROOT/scripts/shell/validate-node-version.sh")" || NODE_VERSION=""




# ─── Dependencies ─────────────────────────────────────────────────────────────────────────────────────────────────────

"$REPO_ROOT/scripts/shell/update-dependencies.sh"




# ─── Status ───────────────────────────────────────────────────────────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────────────────────────────────────────────────────────────────────────────────────"
echo ""
echo -e "\033[1;32m${PROJECT_LABEL}\033[0m || ✅  Shell setup complete!"
echo ""

# Report the validated Node version when the check above passed
if [ -n "$NODE_VERSION" ]; then
  echo -e "\033[4;32m🟢  Node\033[0m\033[0;32m:\033[0m \033[1;32m${NODE_VERSION}\033[0m"
fi

# Report the current project version from package.json
PROJECT_VERSION="v$(node -p "require('$REPO_ROOT/package.json').version" 2>/dev/null || echo '?.?.?')"
echo -e "\033[4;32m📦  Project\033[0m\033[0;32m:\033[0m \033[1;32m${PROJECT_VERSION}\033[0m"

# Report the current git branch
GIT_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
echo -e "\033[4;94m🐙  Branch\033[0m\033[0;94m:\033[0m \033[1;94m${GIT_BRANCH}\033[0m"
echo ""
