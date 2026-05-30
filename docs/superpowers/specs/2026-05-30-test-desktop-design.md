# test-desktop CI 步骤设计

## 概述

在 `release-all.yml` 中新增 `test-desktop` job，对构建好的桌面应用进行 E2E UI 测试，覆盖 Linux、macOS、Windows 三平台。

## 流程

```
prepare → build-cli → test-cli → build-desktop → test-desktop → create-unified-release
```

- `test-desktop` 依赖 `build-desktop` 完成
- `create-unified-release` 依赖 `test-desktop` 通过

## test-desktop Job 设计

### 基本配置

| 项目 | 值 |
|------|-----|
| needs | `[prepare, build-desktop]` |
| if | `needs.build-desktop.result == 'success'` |
| timeout | 20 分钟 |
| permissions | `contents: write` (上传截图到 ci-assets 分支) |

### 平台矩阵

| platform | 产物格式 | 测试脚本 | 特殊处理 |
|----------|----------|----------|----------|
| ubuntu-22.04 | .deb | `scripts/linux/test-desktop-ui.sh` | xvfb-run 虚拟显示 |
| macos-latest | .dmg | `scripts/macos/test-desktop-ui.sh` | xattr -cr 清除隔离 |
| windows-latest | .msi/.exe | `scripts/windows/test-desktop-ui.ps1` | 无特殊处理 |

### 测试步骤

1. **下载构建产物** - 从 `desktop-{platform}` artifact 下载
2. **安装应用**
   - Linux: `sudo dpkg -i *.deb`
   - macOS: 挂载 DMG，复制到 /Applications
   - Windows: 静默安装 MSI
3. **安装 WebdriverIO + tauri-driver**
4. **运行 E2E 测试** - 使用平台脚本
5. **收集截图和日志**
6. **生成 Job Summary** - 展示测试截图

### 系统依赖

#### Linux (ubuntu-22.04)
```bash
sudo apt-get install -y \
  xvfb \
  at-spi2-core \
  libwebkit2gtk-4.1-dev
```

#### macOS
```bash
xattr -cr /Applications/Viben.app
```

#### Windows
无额外依赖，WebView2 已预装。

## 新增文件

### 1. scripts/linux/test-desktop-ui.sh

功能：
- 启动 xvfb 虚拟显示
- 安装并启动 Viben
- 运行 WebdriverIO E2E 测试
- 捕获截图到 test-screenshots/

### 2. scripts/macos/test-desktop-ui.sh

功能：
- 清除 quarantine 属性
- 挂载 DMG 并安装应用
- 运行 WebdriverIO E2E 测试
- 捕获截图

### 3. scripts/windows/test-desktop-ui.ps1

功能：
- 静默安装 MSI/EXE
- 运行 WebdriverIO E2E 测试
- 捕获截图

### 4. scripts/desktop/test-summary.sh

参考 `scripts/android/test-summary.sh`，生成 Job Summary：
- 测试环境信息
- WebdriverIO 测试结果
- 截图表格（上传到 ci-assets 分支）
- 崩溃日志（如有）

### 5. apps/desktop/wdio.conf.ts

WebdriverIO 配置：
- 使用 tauri-driver 连接 Tauri webview
- 配置截图输出目录
- 配置 JUnit 报告输出

### 6. apps/desktop/test/e2e/app.spec.ts

基础 E2E 测试用例：
- 应用启动验证
- 主界面加载
- 基本导航测试
- 截图各关键页面

## release-all.yml 修改

在 `build-desktop` 和 `create-unified-release` 之间插入 `test-desktop` job：

```yaml
test-desktop:
  needs: [prepare, build-desktop]
  if: needs.build-desktop.result == 'success'
  timeout-minutes: 20
  permissions:
    contents: write
  strategy:
    fail-fast: false
    matrix:
      include:
        - platform: ubuntu-22.04
          artifact: desktop-ubuntu-22.04
          test_script: scripts/linux/test-desktop-ui.sh
        - platform: macos-latest
          artifact: desktop-macos-latest
          test_script: scripts/macos/test-desktop-ui.sh
        - platform: windows-latest
          artifact: desktop-windows-latest
          test_script: scripts/windows/test-desktop-ui.ps1
  runs-on: ${{ matrix.platform }}
  steps:
    # ... 详见实现
```

修改 `create-unified-release` 的 needs：
```yaml
create-unified-release:
  needs: [prepare, release-cli, build-desktop, test-desktop]
  if: |
    always() &&
    needs.prepare.outputs.dry_run != 'true' &&
    (needs.release-cli.result == 'success' || needs.build-desktop.result == 'success') &&
    (needs.test-desktop.result == 'success' || needs.test-desktop.result == 'skipped') &&
    needs.prepare.result == 'success'
```

## 产物

| Artifact | 内容 | 保留天数 |
|----------|------|----------|
| desktop-test-screenshots-{platform} | 测试截图 | 14 |
| desktop-test-logs-{platform} | WebdriverIO 日志、JUnit 报告 | 7 |

## 可选：skip_desktop_tests 参数

在 workflow_dispatch inputs 中添加：
```yaml
skip_desktop_tests:
  description: 'Skip desktop E2E tests (faster release)'
  type: boolean
  default: false
```

## 实现顺序

1. 创建 `apps/desktop/wdio.conf.ts`
2. 创建 `apps/desktop/test/e2e/app.spec.ts`
3. 更新 `apps/desktop/package.json` 添加 `test:e2e` 脚本
4. 创建 `scripts/linux/test-desktop-ui.sh`
5. 创建 `scripts/macos/test-desktop-ui.sh`
6. 创建 `scripts/windows/test-desktop-ui.ps1`
7. 创建 `scripts/desktop/test-summary.sh`
8. 修改 `.github/workflows/release-all.yml`
