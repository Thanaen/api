#!/usr/bin/env bash
# Vercel Ignored Build Step for this project.
#
# Configure in Vercel project settings:
#   Settings -> Git -> Ignored Build Step -> "Run my own command"
#   Command:  bash scripts/vercel-ignore-build.sh
#
# Exit codes (per Vercel docs):
#   1 -> build proceeds
#   0 -> build is skipped (no preview deployment, no Neon branch)
#
# We skip builds (and therefore avoid creating a Neon branch) when the
# diff touches ONLY docs or the standalone api-client package, since those
# cannot affect the deployed API.

set -euo pipefail

# Compare against the previous commit on the same ref.
if ! git diff --quiet HEAD^ HEAD -- \
    ':(exclude)**/*.md' \
    ':(exclude)packages/api-client/**' \
    ':(exclude).github/**' \
    ':(exclude)scripts/**'; then
  echo "✅ Relevant changes detected — proceed with build."
  exit 1
fi

echo "🛑 Only docs / api-client / CI / scripts changed — skipping build."
exit 0
