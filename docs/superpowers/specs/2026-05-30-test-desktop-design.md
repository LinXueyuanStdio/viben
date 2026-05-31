# test-desktop CI 步骤设计

## 概述

在 `release-all.yml` 中新增 `test-desktop` job，对构建好的桌面应用进行 E2E UI 测试，覆盖 Linux、macOS、Windows 三平台。

## 流程

```
prepare → build-cli → test-cli → build-desktop → test-desktop → create-unified-release
```

- `build-desktop` 已依赖 `test-cli`，所以 `test-desktop` 只需依赖 `build-desktop`
- `create-unified-release` 依赖 `test-desktop` 通过

## 前置条件：build-desktop 必须启用 WebDriver 自动化

**CRITICAL**: `build-desktop` job 构建时必须设置 `TAURI_WEBVIEW_AUTOMATION=true` 环境变量，否则 tauri-driver 无法连接 webview 进行 E2E 测试。

```yaml
# 在 build-desktop job 的 Build Tauri app 步骤中添加
env:
  TAURI_WEBVIEW_AUTOMATION: true
```

## test-desktop Job 设计

### 基本配置

| 项目 | 值 |
|------|-----|
| needs | `[prepare, build-desktop]` |
| if | `needs.prepare.outputs.release_desktop == 'true' && needs.build-desktop.result == 'success'` |
| timeout | 20 分钟 |
| permissions | `contents: write` (上传截图到 ci-assets 分支) |

### 平台矩阵

| platform | 产物格式 | 测试脚本 | Summary 脚本 | 特殊处理 |
|----------|----------|----------|--------------|----------|
| ubuntu-22.04 | .deb | `scripts/linux/test-desktop-ui.sh` | `scripts/linux/test-desktop-summary.sh` | xvfb-run 虚拟显示 |
| macos-latest | .dmg (aarch64) | `scripts/macos/test-desktop-ui.sh` | `scripts/macos/test-desktop-summary.sh` | xattr -cr 清除隔离 |
| windows-latest | .msi | `scripts/windows/test-desktop-ui.bat` | `scripts/windows/test-desktop-summary.bat` | 无特殊处理 |

> **注意**: macOS runner (macos-latest) 是 ARM64，所以测试 aarch64 版本的 DMG。

### 测试步骤

1. **下载构建产物** - 从 `desktop-{platform}` artifact 下载
2. **安装 Rust 和 tauri-driver**
   ```bash
   cargo install tauri-driver
   ```
3. **安装应用**
   - Linux: `sudo dpkg -i *.deb`
   - macOS: 挂载 DMG (aarch64 版本)，复制到 /Applications，`xattr -cr`
   - Windows: 静默安装 MSI (`msiexec /i ... /quiet`)
4. **Setup Node.js + pnpm** - 安装 WebdriverIO 依赖
5. **运行 E2E 测试** - 使用平台脚本，启动 tauri-driver 和 WebdriverIO
6. **收集截图和日志**
7. **生成 Job Summary** - 展示测试截图 (上传到 ci-assets 分支)

### 系统依赖

#### Linux (ubuntu-22.04)
```bash
sudo apt-get install -y \
  xvfb \
  at-spi2-core \
  libwebkit2gtk-4.1-dev \
  imagemagick  # 用于截图压缩
```

**xvfb-run 使用方式**:
```bash
xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" <command>
```

**安装后 app 路径**: `/usr/bin/viben` 或通过 `which viben` 查找

#### macOS
```bash
# 查找并挂载 aarch64 版本的 DMG
DMG_FILE=$(find desktop-artifact -name "*aarch64*.dmg" -type f | head -1)
VOLUME_PATH=$(hdiutil attach "$DMG_FILE" -nobrowse | grep "/Volumes" | awk '{print $3}')
cp -R "$VOLUME_PATH"/*.app /Applications/
hdiutil detach "$VOLUME_PATH"
xattr -cr /Applications/Viben.app
```

**安装后 app 路径**: `/Applications/Viben.app/Contents/MacOS/Viben`

#### Windows
```batch
REM MSI 静默安装 (带日志)
msiexec /i Viben*.msi /quiet /norestart /log install.log ALLUSERS=1

REM 查找安装路径 (检查两个可能位置)
set "APP_PATH=%LOCALAPPDATA%\Programs\Viben\viben-desktop.exe"
if not exist "%APP_PATH%" set "APP_PATH=%PROGRAMFILES%\Viben\viben-desktop.exe"
```

**安装后 app 路径**: `%LOCALAPPDATA%\Programs\Viben\viben-desktop.exe` 或 `%PROGRAMFILES%\Viben\viben-desktop.exe`

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

### 3. scripts/windows/test-desktop-ui.bat

功能：
- 静默安装 MSI (`msiexec /i ... /quiet /norestart /log install.log ALLUSERS=1`)
- 查找安装路径 (`%LOCALAPPDATA%\Programs\Viben\` 或 `%PROGRAMFILES%\Viben\`)
- 启动 tauri-driver 和运行 WebdriverIO E2E 测试
- 捕获截图

### 4. scripts/lib/upload-ci-assets.sh (已存在)

通用截图上传库，提供：
- `upload_to_ci_assets <upload_dir> file1 file2 ...` - 上传文件到 ci-assets 分支
- `upload_to_ci_assets_with_retry <upload_dir> file1 file2 ...` - 带重试的上传
- `_json_get()` - JSON 解析辅助函数
- 返回 `UPLOADED_URLS` 数组包含上传后的 raw URL

环境变量要求：
- `GITHUB_TOKEN` - GitHub API 认证
- `GITHUB_REPOSITORY` - 仓库名 (owner/repo)

### 4b. scripts/linux/test-desktop-summary.sh

**调用 `scripts/lib/upload-ci-assets.sh`**

生成 Linux Desktop E2E 测试的 Job Summary：
- source ../lib/upload-ci-assets.sh 获取上传功能
- 调用 `upload_to_ci_assets_with_retry "linux/${GITHUB_RUN_ID}" test-screenshots/*.png`
- 测试环境信息表格 (Linux x86_64、WebdriverIO)
- JUnit XML 测试结果解析 (wdio-results.xml)
- 崩溃日志折叠显示
- 截图表格渲染 (使用 UPLOADED_URLS)

### 4c. scripts/macos/test-desktop-summary.sh

**调用 `scripts/lib/upload-ci-assets.sh`**

与 Linux 版本类似：
- source ../lib/upload-ci-assets.sh
- 调用 `upload_to_ci_assets_with_retry "macos/${GITHUB_RUN_ID}" test-screenshots/*.png`

### 4d. scripts/lib/upload-ci-assets.bat (新建)

**参考 `scripts/lib/upload-ci-assets.sh` 构建 Windows 版本**

Windows Batch 版本的上传库：
- 使用 curl (GitHub runner 已预装)
- base64 编码使用 PowerShell: `powershell -NoProfile -Command "[Convert]::ToBase64String([IO.File]::ReadAllBytes('%FILE%'))"`
  - 注: `certutil -encode` 会添加 header/footer 需要额外处理，PowerShell 更简洁
- 输出 URL 列表到文件 `UPLOADED_URLS.txt` (每行一个 URL)
  - 注: Batch 不支持数组返回，使用文件方式

### 4e. scripts/windows/test-desktop-summary.bat

**调用 `scripts/lib/upload-ci-assets.bat`**

Windows 版本的 Summary 生成脚本：
- call ..\lib\upload-ci-assets.bat 获取上传功能
- 上传到 `windows/{run_id}/` 目录
- 简化 XML 解析 (使用 findstr 提取关键信息)

### 5. apps/desktop/wdio.conf.ts

WebdriverIO 配置：
- **端口**: tauri-driver 默认使用 4444 端口
- **capabilities**: 配置 `tauri:options.application` 指向安装的 app 路径
- **截图输出**: `./test-screenshots/`
- **JUnit 报告**: `./wdio-results.xml`

```typescript
import type { Options } from '@wdio/types';

export const config: Options.Testrunner = {
  runner: 'local',
  port: 4444,  // tauri-driver 默认端口
  
  specs: ['./test/e2e/**/*.spec.ts'],
  
  capabilities: [{
    'tauri:options': {
      application: process.env.TAURI_APP_PATH  // 由测试脚本设置
    }
  }],
  
  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 60000 },
  
  reporters: [
    'spec',
    ['junit', { outputDir: './', outputFileFormat: () => 'wdio-results.xml' }]
  ],
  
  afterTest: async function(test) {
    const name = test.title.replace(/[^a-zA-Z0-9]/g, '-');
    await browser.saveScreenshot(`./test-screenshots/${name}.png`);
  }
};
```

**需要安装**: `@wdio/junit-reporter` (添加到 devDependencies)

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
  if: |
    needs.prepare.outputs.release_desktop == 'true' &&
    needs.build-desktop.result == 'success'
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
          summary_script: scripts/linux/test-desktop-summary.sh
        - platform: macos-latest
          artifact: desktop-macos-latest
          test_script: scripts/macos/test-desktop-ui.sh
          summary_script: scripts/macos/test-desktop-summary.sh
        - platform: windows-latest
          artifact: desktop-windows-latest
          test_script: scripts/windows/test-desktop-ui.bat
          summary_script: scripts/windows/test-desktop-summary.bat
  runs-on: ${{ matrix.platform }}
  steps:
    - name: Checkout
      uses: actions/checkout@v6

    - name: Download desktop artifact
      uses: actions/download-artifact@v8
      with:
        name: ${{ matrix.artifact }}
        path: desktop-artifact

    - name: Setup Node.js + pnpm
      uses: ./.github/actions/setup-node-pnpm

    - name: Install Rust stable
      uses: dtolnay/rust-toolchain@stable

    - name: Install tauri-driver
      run: cargo install tauri-driver

    - name: Install Linux dependencies
      if: matrix.platform == 'ubuntu-22.04'
      run: |
        sudo apt-get update
        sudo apt-get install -y xvfb at-spi2-core imagemagick

    # Unix (Linux/macOS)
    - name: Run E2E tests (Unix)
      if: matrix.platform != 'windows-latest'
      shell: bash
      run: |
        chmod +x "${{ matrix.test_script }}"
        "${{ matrix.test_script }}"

    # Windows
    - name: Run E2E tests (Windows)
      if: matrix.platform == 'windows-latest'
      shell: cmd
      run: ${{ matrix.test_script }}

    - name: Upload test screenshots
      if: always()
      uses: actions/upload-artifact@v7
      with:
        name: desktop-test-screenshots-${{ matrix.platform }}
        path: test-screenshots/
        retention-days: 14

    # Unix (Linux/macOS)
    - name: Generate job summary (Unix)
      if: always() && matrix.platform != 'windows-latest'
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      shell: bash
      run: |
        chmod +x "${{ matrix.summary_script }}"
        "${{ matrix.summary_script }}" test-screenshots wdio-results.xml

    # Windows
    - name: Generate job summary (Windows)
      if: always() && matrix.platform == 'windows-latest'
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      shell: cmd
      run: ${{ matrix.summary_script }} test-screenshots wdio-results.xml
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

1. 创建 `apps/desktop/wdio.conf.ts` - WebdriverIO 配置
2. 创建 `apps/desktop/test/e2e/app.spec.ts` - E2E 测试用例
3. 更新 `apps/desktop/package.json` 添加 `test:e2e` 脚本
4. 创建 `scripts/linux/test-desktop-ui.sh` - Linux 测试脚本
5. 创建 `scripts/macos/test-desktop-ui.sh` - macOS 测试脚本
6. 创建 `scripts/windows/test-desktop-ui.bat` - Windows 测试脚本
7. 创建 `scripts/lib/upload-ci-assets.bat` - Windows 版通用上传库 (参考 lib/upload-ci-assets.sh)
8. 创建 `scripts/linux/test-desktop-summary.sh` - Linux Summary (调用 lib/upload-ci-assets.sh)
9. 创建 `scripts/macos/test-desktop-summary.sh` - macOS Summary (调用 lib/upload-ci-assets.sh)
10. 创建 `scripts/windows/test-desktop-summary.bat` - Windows Summary (调用 lib/upload-ci-assets.bat)
11. 修改 `.github/workflows/release-all.yml` - 添加 test-desktop job

## 参考文件

实现时需要参考以下现有文件：

| 文件 | 用途 |
|------|------|
| `scripts/lib/upload-ci-assets.sh` | 通用截图上传库 (已存在，直接调用) |
| `scripts/android/test-summary.sh` | Summary 脚本模板 (JUnit 解析、截图表格渲染) |
| `scripts/linux/test-cli-gateway.sh` | Linux 测试脚本模板 (颜色输出、错误处理) |
| `scripts/macos/test-cli-gateway.sh` | macOS 测试脚本模板 |
| `scripts/windows/test-cli-gateway.bat` | Windows 脚本参考 |
| `.github/workflows/release-mobile.yml` | test-android/test-ios job 结构参考 |

## ci-assets 分支路径

截图上传到 ci-assets 分支的路径规范：
- Linux: `linux/{GITHUB_RUN_ID}/`
- macOS: `macos/{GITHUB_RUN_ID}/`
- Windows: `windows/{GITHUB_RUN_ID}/`
