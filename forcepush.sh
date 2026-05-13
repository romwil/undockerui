#!/bin/bash
# force-push-ui.sh - The "I'm not asking anymore" deployment

SOURCE_DIR="/mnt/user/appdata/undockerui"
PLUGIN_NAME="undockerui"
PAGE_BASE="UndockerUI"
RAM_PATH="/usr/local/emhttp/plugins/$PLUGIN_NAME"

echo "Purging old links and ghosts..."
rm -f /usr/local/emhttp/plugins/$PLUGIN_NAME.page
rm -rf "$RAM_PATH"

echo "Creating physical plugin directory..."
mkdir -p "$RAM_PATH"

# .page must be under plugins/<plugin>/ — emhttp only globs plugins/*/*.page
# Strip CR so "\n---\n" header split matches (CRLF breaks menu registration).
echo "Copying .page file into plugin directory..."
sed 's/\r$//' "$SOURCE_DIR/plugin/$PAGE_BASE.page" > "$RAM_PATH/$PAGE_BASE.page"
chmod 644 "$RAM_PATH/$PAGE_BASE.page"

# Keep the links for the assets to save RAM, but link the PHP entry point specifically
echo "Linking SPA assets..."
ln -sf "$SOURCE_DIR/plugin/$PLUGIN_NAME.php" "$RAM_PATH/$PLUGIN_NAME.php"
ln -sf "$SOURCE_DIR/plugin/dist" "$RAM_PATH/dist"

echo "Nuking the emhttp template cache..."
rm -f /var/local/emhttp/*.php

echo "Done. Hard-refresh the WebGUI — open 'UndockerUI' on the top bar (after Docker, when Docker is enabled). URL is /UndockerUI."