#!/bin/sh

set -e

cd "$CI_WORKSPACE"

npm ci

cd ios

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

pod install
