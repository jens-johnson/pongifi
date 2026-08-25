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
# ██████████████████████████████████████████ scripts/shell/check-node-lts.sh ██████████████████████████████████████████
#
# Compares the .nvmrc pin against the latest Node LTS from the nodejs.org release index.
#
# ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
#
# Runs weekly via the node-lts-watch workflow; invoke manually with `bash scripts/shell/check-node-lts.sh` (requires
# curl + jq).
#
# ─── RETURNS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
#
#   • GITHUB_OUTPUT-compatible key=value lines on stdout: pinned=<vX>, latest=<vX.Y.Z>, bump=<true|false>
#
# ─── SEE ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
#
#   • https://nodejs.org/dist/index.json
#
# █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████

# ─── Setup ───────────────────────────────────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Resolve the repo root relative to this script so it runs from any working directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# The Node release index; newest releases first, LTS entries carry a codename in their lts field
NODE_RELEASE_INDEX_URL="https://nodejs.org/dist/index.json"




# ─── Version Comparison ──────────────────────────────────────────────────────────────────────────────────────────────

echo "Comparing the .nvmrc pin against the latest Node LTS..." >&2

# Read the pinned major from .nvmrc (tolerating a leading v or a full major.minor.patch pin)
PINNED_NODE_VERSION="$(tr -d 'v[:space:]' < "$REPO_ROOT/.nvmrc")"
PINNED_NODE_MAJOR="${PINNED_NODE_VERSION%%.*}"

# Fetch the release index and take the newest LTS entry
LATEST_LTS_VERSION="$(curl -fsSL "$NODE_RELEASE_INDEX_URL" | jq -r '[.[] | select(.lts != false)][0].version')"
LATEST_LTS_MAJOR="${LATEST_LTS_VERSION#v}"
LATEST_LTS_MAJOR="${LATEST_LTS_MAJOR%%.*}"

# The pin is stale when a newer LTS major exists
BUMP_NEEDED="false"
if [ "$LATEST_LTS_MAJOR" -gt "$PINNED_NODE_MAJOR" ]; then
  BUMP_NEEDED="true"
fi




# ─── Output ──────────────────────────────────────────────────────────────────────────────────────────────────────────

# The payload is key=value lines (GITHUB_OUTPUT-compatible); narration above went to stderr
echo "pinned=v${PINNED_NODE_VERSION}"
echo "latest=${LATEST_LTS_VERSION}"
echo "bump=${BUMP_NEEDED}"
