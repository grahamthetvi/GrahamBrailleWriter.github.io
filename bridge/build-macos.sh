#!/bin/bash
set -e

APP_NAME="Braille Vibe Bridge.app"
CONTENTS_DIR="$APP_NAME/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"

echo "Creating macOS App Bundle..."
mkdir -p "$MACOS_DIR"

# Write Info.plist (LSUIElement=true hides the dock icon)
cat <<EOF > "$CONTENTS_DIR/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleExecutable</key>
	<string>bridge</string>
	<key>CFBundleIdentifier</key>
	<string>com.grahamthetvi.braillevibebridge</string>
	<key>CFBundleName</key>
	<string>Braille Vibe Bridge</string>
	<key>CFBundleVersion</key>
	<string>1.0</string>
	<key>LSUIElement</key>
	<true/>
</dict>
</plist>
EOF

echo "Building Universal macOS Binary..."
GOOS=darwin GOARCH=amd64 go build -o bridge-amd64 .
GOOS=darwin GOARCH=arm64 go build -o bridge-arm64 .

# Use lipo to create a universal binary if available, otherwise fallback to arm64
if command -v lipo >/dev/null 2>&1; then
    lipo -create -output "$MACOS_DIR/bridge" bridge-amd64 bridge-arm64
else
    echo "Warning: lipo not found, using arm64 binary"
    cp bridge-arm64 "$MACOS_DIR/bridge"
fi

rm -f bridge-amd64 bridge-arm64

echo "Done! The app bundle is in $APP_NAME"
