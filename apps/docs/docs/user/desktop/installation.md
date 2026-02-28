---
sidebar_position: 2
title: "桌面应用安装"
description: "在 macOS、Windows 和 Linux 上安装 Viben 桌面应用"
---

# 桌面应用安装

详细的 Viben Desktop 安装指南，适用于所有支持的平台。

## 下载

[![最新版本](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

从 [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop) 下载最新版本。

---

## macOS

### 系统要求

- macOS 10.15 (Catalina) 或更高
- Apple Silicon (M1/M2/M3/M4) 或 Intel 处理器

### 安装步骤

1. 下载 `Viben_x.x.x_universal.dmg` 文件
2. 双击打开磁盘映像
3. 拖动 **Viben** 到 **Applications** 文件夹
4. 推出磁盘映像

### 首次启动

由于 Viben 未经 Apple 公证，首次启动时可能会看到安全警告：

**方法一：右键打开**
1. 打开 **Finder** 并进入 **Applications**
2. 右键点击（或 Control + 点击）**Viben**
3. 从菜单中选择 **打开**
4. 在对话框中点击 **打开**

**方法二：系统偏好设置**
1. 前往 **系统偏好设置** > **安全性与隐私** > **通用**
2. 点击 Viben 警告旁边的 **仍要打开**

### 故障排除

**"Viben 已损坏，无法打开"**

这是 macOS 隔离应用导致的。移除隔离标志：

```bash
xattr -cr /Applications/Viben.app
```

**"无法打开 Viben，因为无法验证开发者"**

这是未签名应用的正常提示。使用上述方法绕过 Gatekeeper。

---

## Windows

### 系统要求

- Windows 10 或 Windows 11 (64 位)
- WebView2 Runtime（通常已预装在 Windows 10/11 上）

### 安装步骤

**使用 MSI 安装程序（推荐）：**

1. 下载 `Viben_x.x.x_x64_en-US.msi`
2. 双击运行安装程序
3. 按照安装向导操作
4. 完成后点击 **完成**

**使用 EXE 安装程序：**

1. 下载 `Viben_x.x.x_x64-setup.exe`
2. 双击运行
3. 按照提示操作

### 首次启动

从以下位置启动 Viben：
- 开始菜单 > Viben
- 桌面快捷方式（如果安装时创建）

### 故障排除

**SmartScreen 警告**

Windows 可能会对未签名应用显示 SmartScreen 警告：

1. 点击 **更多信息**
2. 点击 **仍要运行**

**缺少 WebView2**

如果看到 WebView2 错误，请下载安装：
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

---

## Linux

### 系统要求

- 64 位 Linux 发行版
- GTK 3 和 WebKitGTK（用于 WebView）
- glibc 2.31 或更高

### AppImage（通用）

AppImage 无需安装即可在大多数 Linux 发行版上运行：

```bash
# 下载 AppImage
wget https://github.com/LinXueyuanStdio/viben/releases/latest/download/Viben_x.x.x_amd64.AppImage

# 添加执行权限
chmod +x Viben_*.AppImage

# 运行
./Viben_*.AppImage
```

:::tip
为方便访问，可以将 AppImage 移动到 `~/.local/bin/` 并将该目录添加到 PATH。
:::

### Debian/Ubuntu (.deb)

适用于 Debian、Ubuntu、Linux Mint 等基于 Debian 的发行版：

```bash
# 下载 .deb 包
wget https://github.com/LinXueyuanStdio/viben/releases/latest/download/Viben_x.x.x_amd64.deb

# 安装
sudo dpkg -i Viben_*_amd64.deb

# 修复缺失的依赖
sudo apt-get install -f
```

从应用菜单启动或运行：

```bash
viben
```

### 依赖

如果遇到依赖问题，安装以下包：

**Ubuntu/Debian：**
```bash
sudo apt-get install libwebkit2gtk-4.1-0 libappindicator3-1
```

**Fedora：**
```bash
sudo dnf install webkit2gtk4.1 libappindicator-gtk3
```

**Arch Linux：**
```bash
sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3
```

---

## 验证下载

所有发布版本都包含 SHA256 校验和用于验证。

### 下载校验和

1. 从发布页面下载 `checksums.txt`
2. 下载对应平台的安装包

### macOS/Linux 验证

```bash
# 进入下载目录
cd ~/Downloads

# 验证校验和
sha256sum -c checksums.txt 2>/dev/null | grep -E "Viben.*OK"
```

### Windows (PowerShell) 验证

```powershell
# 获取下载文件的哈希
$hash = (Get-FileHash "Viben_x.x.x_x64-setup.exe" -Algorithm SHA256).Hash

# 与 checksums.txt 比较
Get-Content checksums.txt | Select-String $hash
```

---

## 更新

Viben 目前不支持自动更新。要更新：

1. 从 [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop) 下载最新版本
2. 覆盖安装（你的设置会保留）

:::info
自动更新功能计划在未来版本中推出。
:::

---

## 卸载

### macOS

1. 打开 **Finder** > **Applications**
2. 将 **Viben** 拖到废纸篓
3. 清空废纸篓

要删除所有数据：
```bash
rm -rf ~/Library/Application\ Support/com.viben.app
rm -rf ~/Library/Caches/com.viben.app
```

### Windows

1. 打开 **设置** > **应用** > **已安装的应用**
2. 找到 **Viben**
3. 点击 **卸载**

或使用控制面板 > 程序和功能。

### Linux

**AppImage：** 直接删除 AppImage 文件。

**Debian 包：**
```bash
sudo apt-get remove viben
```

要删除配置：
```bash
rm -rf ~/.config/viben
rm -rf ~/.local/share/viben
```

---

## 下一步

- [功能介绍](./features) - 探索完整功能
- [快速入门](../getting-started/quick-start) - 2 分钟上手
- [客户端配置](../getting-started/client-configuration) - 配置 MCP 客户端
