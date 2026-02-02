---
sidebar_position: 2
title: "Installation"
description: "How to install Browse MCP Desktop on macOS, Windows, and Linux"
---

# Desktop App Installation

Detailed installation instructions for Browse MCP Desktop on all supported platforms.

## Download

[![Latest Release](https://img.shields.io/github/v/release/LinXueyuanStdio/browse-mcp?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/browse-mcp/releases?q=desktop)

Download the latest version from [GitHub Releases](https://github.com/LinXueyuanStdio/browse-mcp/releases?q=desktop).

## macOS

### Requirements

- macOS 10.15 (Catalina) or later
- Apple Silicon (M1/M2/M3) or Intel processor

### Installation Steps

1. Download the `Browse-MCP_x.x.x_universal.dmg` file
2. Double-click to open the disk image
3. Drag **Browse MCP** to the **Applications** folder
4. Eject the disk image

### First Launch

Since Browse MCP is not notarized by Apple, you may see a security warning on first launch:

**Option 1: Right-click to Open**
1. Open **Finder** and go to **Applications**
2. Right-click (or Control-click) on **Browse MCP**
3. Select **Open** from the context menu
4. Click **Open** in the dialog

**Option 2: System Preferences**
1. Go to **System Preferences** > **Security & Privacy** > **General**
2. Click **Open Anyway** next to the Browse MCP warning

### Troubleshooting

**"Browse MCP is damaged and can't be opened"**

This happens when macOS quarantines the app. Remove the quarantine flag:

```bash
xattr -cr /Applications/Browse\ MCP.app
```

**"Browse MCP cannot be opened because the developer cannot be verified"**

This is expected for unsigned apps. Use one of the methods above to bypass Gatekeeper.

---

## Windows

### Requirements

- Windows 10 or Windows 11 (64-bit)
- WebView2 Runtime (usually pre-installed on Windows 10/11)

### Installation Steps

**Using the MSI Installer (Recommended):**

1. Download `Browse-MCP_x.x.x_x64_en-US.msi`
2. Double-click to run the installer
3. Follow the installation wizard
4. Click **Finish** when complete

**Using the EXE Installer:**

1. Download `Browse-MCP_x.x.x_x64-setup.exe`
2. Double-click to run
3. Follow the prompts

### First Launch

Launch Browse MCP from:
- Start Menu > Browse MCP
- Desktop shortcut (if created during installation)

### Troubleshooting

**SmartScreen Warning**

Windows may show a SmartScreen warning for unsigned apps:

1. Click **More info**
2. Click **Run anyway**

**Missing WebView2**

If you see a WebView2 error, download and install it from:
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

---

## Linux

### Requirements

- 64-bit Linux distribution
- GTK 3 and WebKitGTK (for WebView)
- glibc 2.31 or later

### AppImage (Universal)

AppImage works on most Linux distributions without installation:

```bash
# Download the AppImage
wget https://github.com/LinXueyuanStdio/browse-mcp/releases/latest/download/Browse-MCP_x.x.x_amd64.AppImage

# Make it executable
chmod +x Browse-MCP_*.AppImage

# Run
./Browse-MCP_*.AppImage
```

:::tip
For easier access, move the AppImage to `~/.local/bin/` and add that directory to your PATH.
:::

### Debian/Ubuntu (.deb)

For Debian, Ubuntu, Linux Mint, and other Debian-based distributions:

```bash
# Download the .deb package
wget https://github.com/LinXueyuanStdio/browse-mcp/releases/latest/download/Browse-MCP_x.x.x_amd64.deb

# Install
sudo dpkg -i Browse-MCP_*_amd64.deb

# Fix any missing dependencies
sudo apt-get install -f
```

Launch from your application menu or run:

```bash
browse-mcp-desktop
```

### Dependencies

If you encounter dependency issues, install these packages:

**Ubuntu/Debian:**
```bash
sudo apt-get install libwebkit2gtk-4.1-0 libappindicator3-1
```

**Fedora:**
```bash
sudo dnf install webkit2gtk4.1 libappindicator-gtk3
```

**Arch Linux:**
```bash
sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3
```

---

## Verifying Downloads

All releases include SHA256 checksums for verification.

### Download Checksums

1. Download `checksums.txt` from the release page
2. Download your platform's installer

### Verify on macOS/Linux

```bash
# Navigate to download directory
cd ~/Downloads

# Verify checksum
sha256sum -c checksums.txt 2>/dev/null | grep -E "Browse-MCP.*OK"
```

### Verify on Windows (PowerShell)

```powershell
# Get the hash of downloaded file
$hash = (Get-FileHash "Browse-MCP_x.x.x_x64-setup.exe" -Algorithm SHA256).Hash

# Compare with checksums.txt
Get-Content checksums.txt | Select-String $hash
```

---

## Updating

Browse MCP does not currently auto-update. To update:

1. Download the latest version from [GitHub Releases](https://github.com/LinXueyuanStdio/browse-mcp/releases?q=desktop)
2. Install over the existing version (your settings will be preserved)

:::info
Auto-update functionality is planned for a future release.
:::

---

## Uninstalling

### macOS

1. Open **Finder** > **Applications**
2. Drag **Browse MCP** to the Trash
3. Empty Trash

To remove all data:
```bash
rm -rf ~/Library/Application\ Support/com.browsemcp.app
rm -rf ~/Library/Caches/com.browsemcp.app
```

### Windows

1. Open **Settings** > **Apps** > **Installed apps**
2. Find **Browse MCP**
3. Click **Uninstall**

Or use Control Panel > Programs and Features.

### Linux

**AppImage:** Simply delete the AppImage file.

**Debian package:**
```bash
sudo apt-get remove browse-mcp-desktop
```

To remove configuration:
```bash
rm -rf ~/.config/browse-mcp
rm -rf ~/.local/share/browse-mcp
```
