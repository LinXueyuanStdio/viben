---
sidebar_position: 2
title: "Desktop Installation"
description: "Install Viben Desktop - Agent Swarm x Code Evolution Platform"
---

# Desktop Installation

Detailed installation guide for Viben Desktop. Viben Desktop is an Agent Swarm x Code Evolution platform that drives continuous code evolution through agent swarms and reinforcement learning.

## Download

[![Latest Version](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

Download the latest version from [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop).

---

## macOS

### System Requirements

- macOS 10.15 (Catalina) or higher
- Apple Silicon (M1/M2/M3/M4) or Intel processor

### Installation Steps

1. Download the `Viben_x.x.x_universal.dmg` file
2. Double-click to open the disk image
3. Drag **Viben** to the **Applications** folder
4. Eject the disk image

### First Launch

Since Viben is not notarized by Apple, you may see a security warning on first launch:

**Method 1: Right-click to Open**
1. Open **Finder** and navigate to **Applications**
2. Right-click (or Control + click) **Viben**
3. Select **Open** from the menu
4. Click **Open** in the dialog

**Method 2: System Preferences**
1. Go to **System Preferences** > **Security & Privacy** > **General**
2. Click **Open Anyway** next to the Viben warning

### Troubleshooting

**"Viben is damaged and can't be opened"**

This is caused by macOS quarantine. Remove the quarantine flag:

```bash
xattr -cr /Applications/Viben.app
```

**"Cannot open Viben because the developer cannot be verified"**

This is a normal prompt for unsigned applications. Use the methods above to bypass Gatekeeper.

---

## Windows

### System Requirements

- Windows 10 or Windows 11 (64-bit)
- WebView2 Runtime (usually pre-installed on Windows 10/11)

### Installation Steps

**Using MSI Installer (Recommended):**

1. Download `Viben_x.x.x_x64_en-US.msi`
2. Double-click to run the installer
3. Follow the installation wizard
4. Click **Finish** when complete

**Using EXE Installer:**

1. Download `Viben_x.x.x_x64-setup.exe`
2. Double-click to run
3. Follow the prompts

### First Launch

Launch Viben from:
- Start Menu > Viben
- Desktop shortcut (if created during installation)

### Troubleshooting

**SmartScreen Warning**

Windows may show a SmartScreen warning for unsigned applications:

1. Click **More info**
2. Click **Run anyway**

**Missing WebView2**

If you see a WebView2 error, download and install it:
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

---

## Linux

### System Requirements

- 64-bit Linux distribution
- GTK 3 and WebKitGTK (for WebView)
- glibc 2.31 or higher

### AppImage (Universal)

AppImage runs on most Linux distributions without installation:

```bash
# Download AppImage
wget https://github.com/LinXueyuanStdio/viben/releases/latest/download/Viben_x.x.x_amd64.AppImage

# Add execute permission
chmod +x Viben_*.AppImage

# Run
./Viben_*.AppImage
```

:::tip
For easy access, you can move the AppImage to `~/.local/bin/` and add that directory to your PATH.
:::

### Debian/Ubuntu (.deb)

For Debian-based distributions like Debian, Ubuntu, Linux Mint:

```bash
# Download .deb package
wget https://github.com/LinXueyuanStdio/viben/releases/latest/download/Viben_x.x.x_amd64.deb

# Install
sudo dpkg -i Viben_*_amd64.deb

# Fix missing dependencies
sudo apt-get install -f
```

Launch from the application menu or run:

```bash
viben
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

## Verify Download

All releases include SHA256 checksums for verification.

### Download Checksums

1. Download `checksums.txt` from the release page
2. Download the installer for your platform

### macOS/Linux Verification

```bash
# Navigate to download directory
cd ~/Downloads

# Verify checksum
sha256sum -c checksums.txt 2>/dev/null | grep -E "Viben.*OK"
```

### Windows (PowerShell) Verification

```powershell
# Get hash of downloaded file
$hash = (Get-FileHash "Viben_x.x.x_x64-setup.exe" -Algorithm SHA256).Hash

# Compare with checksums.txt
Get-Content checksums.txt | Select-String $hash
```

---

## Updates

Viben currently does not support automatic updates. To update:

1. Download the latest version from [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)
2. Install over the existing version (your settings will be preserved)

:::info
Automatic update functionality is planned for a future release.
:::

---

## Uninstall

### macOS

1. Open **Finder** > **Applications**
2. Drag **Viben** to Trash
3. Empty Trash

To remove all data:
```bash
rm -rf ~/Library/Application\ Support/com.viben.app
rm -rf ~/Library/Caches/com.viben.app
```

### Windows

1. Open **Settings** > **Apps** > **Installed apps**
2. Find **Viben**
3. Click **Uninstall**

Or use Control Panel > Programs and Features.

### Linux

**AppImage:** Simply delete the AppImage file.

**Debian package:**
```bash
sudo apt-get remove viben
```

To remove configuration:
```bash
rm -rf ~/.config/viben
rm -rf ~/.local/share/viben
```

---

## Next Steps

- [Features](./features) - Explore the complete feature set
- [Quick Start](../getting-started/quick-start) - Get started in 2 minutes
- [Client Configuration](../getting-started/client-configuration) - Configure MCP clients
