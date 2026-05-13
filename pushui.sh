#!/bin/bash
# dev-sync.sh - Deploy plugin into RAM emhttp tree.
# .page files MUST live under /usr/local/emhttp/plugins/<name>/*.page — the GUI
# only discovers plugins/*/*.page (not plugins/foo.page at the plugins root).

SOURCE_DIR="/mnt/user/appdata/undockerui"
PLUGIN_DIR="/usr/local/emhttp/plugins/undockerui"

echo "Cleaning up old links..."
rm -f /usr/local/emhttp/plugins/undockerui.page
rm -rf "$PLUGIN_DIR"

echo "Injecting symlinks..."
mkdir -p "$PLUGIN_DIR"

# Top-bar label uses Name, else the .page basename. Route URL is /basename (e.g. /UndockerUI).
# Copy .page with CRLF stripped — Dynamix splits header/body on LF-only "\n---\n".
sed 's/\r$//' "$SOURCE_DIR/plugin/UndockerUI.page" > "$PLUGIN_DIR/UndockerUI.page"
chmod 644 "$PLUGIN_DIR/UndockerUI.page"

# Link the internal assets
ln -sf "$SOURCE_DIR/plugin/undockerui.php" "$PLUGIN_DIR/undockerui.php"
ln -sf "$SOURCE_DIR/plugin/dist" "$PLUGIN_DIR/dist"

echo "Nuking the emhttp template cache..."
rm -f /var/local/emhttp/*.php

echo "Done. Hard-refresh the WebGUI — open 'UndockerUI' on the top bar (after Docker, when Docker is enabled). URL is /UndockerUI."