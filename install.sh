#!/usr/bin/env bash
# Quickstart-template bootstrapper. Curl-pipeable.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/<USER>/quickstart-template/main/install.sh | bash -s -- my-app
set -euo pipefail

TEMPLATE_REPO="https://github.com/__GH_USER__/quickstart-template.git"   # Stage 3 fills __GH_USER__ at publish time
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  echo "Usage: install.sh <project-directory>" >&2
  exit 1
fi

if [[ -e "$TARGET" ]]; then
  echo "Error: '$TARGET' already exists. Choose a different directory." >&2
  exit 1
fi

for tool in git pnpm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Error: '$tool' is required but not found. Install it and retry." >&2
    exit 1
  fi
done

echo "Cloning template into $TARGET..."
git clone --depth=1 "$TEMPLATE_REPO" "$TARGET"
cd "$TARGET"

echo "Installing dependencies..."
pnpm install

echo "Re-initializing git..."
rm -rf .git
git init -q
git add -A
git commit -q -m "chore: initial commit from quickstart-template"

cat <<NEXT

✅ Template ready in $(pwd).

Next: open this directory in Claude Code, Codex, or Cursor and say:

    run quickstart-setup

The setup skill will interview you, provision Cloudflare resources,
customize the template to your project, and clean up after itself.

NEXT
