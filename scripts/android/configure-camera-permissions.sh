#!/bin/bash
# Configure Android camera permissions for QR code scanning
# This script ensures the CAMERA permission and hardware feature are declared in AndroidManifest.xml

set -e

ANDROID_DIR="${1:-apps/desktop/src-tauri/gen/android}"

cd "$ANDROID_DIR"

MANIFEST_FILE="app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "AndroidManifest.xml not found at $MANIFEST_FILE, skipping camera permission configuration"
  exit 0
fi

echo "Found AndroidManifest at: $MANIFEST_FILE"

# Check if CAMERA permission already exists
if grep -q 'android.permission.CAMERA' "$MANIFEST_FILE"; then
  echo "CAMERA permission already declared in AndroidManifest.xml"
else
  echo "Adding CAMERA permission to AndroidManifest.xml..."
  # Insert permission after the opening manifest tag or after existing permissions
  sed -i '/<manifest/,/<application/ {
    /<uses-permission/{
      :a
      n
      /<uses-permission/ba
      i\    <uses-permission android:name="android.permission.CAMERA" />
      b
    }
    /<application/{
      i\    <uses-permission android:name="android.permission.CAMERA" />
    }
  }' "$MANIFEST_FILE"

  # Verify the permission was added
  if grep -q 'android.permission.CAMERA' "$MANIFEST_FILE"; then
    echo "CAMERA permission added successfully"
  else
    echo "Warning: Failed to add CAMERA permission automatically, adding before <application> tag..."
    sed -i 's|<application|<uses-permission android:name="android.permission.CAMERA" />\n    <application|' "$MANIFEST_FILE"
  fi
fi

# Check if camera hardware feature already exists
if grep -q 'android.hardware.camera' "$MANIFEST_FILE"; then
  echo "Camera hardware feature already declared in AndroidManifest.xml"
else
  echo "Adding camera hardware feature to AndroidManifest.xml..."
  # Insert after the CAMERA permission
  sed -i '/<uses-permission android:name="android.permission.CAMERA"/a\    <uses-feature android:name="android.hardware.camera" android:required="false" />' "$MANIFEST_FILE"

  # Verify the feature was added
  if grep -q 'android.hardware.camera' "$MANIFEST_FILE"; then
    echo "Camera hardware feature added successfully"
  else
    echo "Warning: Failed to add camera hardware feature automatically"
  fi
fi

echo ""
echo "=== Camera permission configuration in AndroidManifest.xml ==="
grep -E "(CAMERA|android.hardware.camera)" "$MANIFEST_FILE" || echo "No camera-related entries found"
echo ""
