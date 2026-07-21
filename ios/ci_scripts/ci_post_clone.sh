#!/bin/sh

set -e

cd "${CI_PRIMARY_REPOSITORY_PATH:-$CI_WORKSPACE}"

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

BREW_BIN="$(command -v brew || true)"
if [ -z "$BREW_BIN" ] && [ -x /opt/homebrew/bin/brew ]; then
  BREW_BIN=/opt/homebrew/bin/brew
fi
if [ -z "$BREW_BIN" ] && [ -x /usr/local/bin/brew ]; then
  BREW_BIN=/usr/local/bin/brew
fi
if [ -z "$BREW_BIN" ]; then
  echo "Homebrew is required to install Node.js for this Xcode Cloud build."
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  "$BREW_BIN" install node@20
  "$BREW_BIN" link node@20 --force --overwrite
fi

export PATH="/opt/homebrew/opt/node@20/bin:/usr/local/opt/node@20/bin:$PATH"

npm ci

cd ios

if ! command -v pod >/dev/null 2>&1; then
  "$BREW_BIN" install cocoapods
fi

pod install
