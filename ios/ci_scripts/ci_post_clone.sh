#!/bin/zsh
# Xcode Cloud post-clone hook. Runs after Apple clones the repo and before
# dependency resolution/build. ios/ is gitignored (Expo continuous native
# generation), so this script regenerates it fresh on every Xcode Cloud run.
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

echo "Running expo prebuild (npm run pre)..."
npm run pre

echo "Installing CocoaPods dependencies..."
cd ios
pod install

echo "ci_post_clone.sh complete."
