#!/bin/zsh
# Xcode Cloud post-clone hook. Runs after Apple clones the repo and before
# dependency resolution/build. ios/ is gitignored (Expo continuous native
# generation), so this script regenerates it fresh on every Xcode Cloud run.
set -euo pipefail

# Xcode Cloud VMs don't ship Node.js by default.
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js via Homebrew..."
  brew install node
fi

cd "$CI_WORKSPACE"

echo "Installing npm dependencies..."
npm ci

echo "Running expo prebuild (npm run pre)..."
npm run pre

echo "Installing CocoaPods dependencies..."
cd ios
pod install

echo "ci_post_clone.sh complete."
