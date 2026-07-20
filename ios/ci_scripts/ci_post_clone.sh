#!/bin/zsh
# Xcode Cloud post-clone hook. Runs after Apple clones the repo and before
# dependency resolution/build. ios/ is committed as source of truth (bare
# React Native) -- this script only installs JS/CocoaPods deps, it does not
# regenerate native code.
set -euo pipefail

# Xcode Cloud VMs don't ship Node.js by default.
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js via Homebrew..."
  export HOMEBREW_NO_AUTO_UPDATE=1
  export HOMEBREW_NO_INSTALL_CLEANUP=1
  export HOMEBREW_NO_ENV_HINTS=1
  brew install node
fi

# Xcode Cloud runs this script with CWD already at ios/ci_scripts, so the
# repo root is reliably two levels up regardless of the mount path or which
# CI_* env vars this environment happens to set.
cd "$(dirname "$0")/../.."

echo "Installing npm dependencies..."
npm ci

echo "Installing CocoaPods dependencies..."
cd ios
pod install

echo "ci_post_clone.sh complete."
