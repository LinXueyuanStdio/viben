#!/bin/bash
# Simple server for the voice assistant demo
# Web Speech API requires HTTPS or localhost

echo "Starting voice assistant demo server..."
echo "Open http://localhost:8080 in Chrome or Safari"
echo ""

cd "$(dirname "$0")"
python3 -m http.server 8080
