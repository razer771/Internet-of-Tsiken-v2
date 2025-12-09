#!/usr/bin/env bash

# EAS Build hook to disable New Architecture
# This runs before npm install

set -e

echo "🔧 Disabling New Architecture in gradle.properties..."

GRADLE_PROPS="android/gradle.properties"

if [ -f "$GRADLE_PROPS" ]; then
  # Replace newArchEnabled=true with newArchEnabled=false
  sed -i 's/newArchEnabled=true/newArchEnabled=false/g' "$GRADLE_PROPS"
  
  echo "✅ New Architecture disabled"
  echo "📄 Current gradle.properties content:"
  cat "$GRADLE_PROPS"
else
  echo "❌ gradle.properties not found at $GRADLE_PROPS"
  exit 1
fi
