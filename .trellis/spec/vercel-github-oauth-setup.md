# Vercel 部署 + GitHub OAuth 集成 - 完整操作指南

> 手把手教你部署 Browse MCP 到 Vercel 并配置 GitHub 登录

---

## 📋 前置准备清单

在开始之前，确保你有：
- [ ] GitHub 账号
- [ ] Vercel 账号（可以用 GitHub 登录）
- [ ] Neon 数据库连接字符串（你已有）
- [ ] 项目已推送到 GitHub

---

## 🚀 第一步：部署到 Vercel

### 1.1 导入 GitHub 项目到 Vercel

1. **访问 Vercel**
   - 打开 https://vercel.com
   - 点击右上角 **"Login"** 或 **"Sign Up"**
   - 选择 **"Continue with GitHub"**

2. **导入项目**
   - 登录后，点击 **"Add New..."** → **"Project"**
   - 在 "Import Git Repository" 页面，找到 `LinXueyuanStdio/browse-mcp`
   - 点击 **"Import"**

3. **配置项目**

   在 "Configure Project" 页面：

   ```
   Project Name: browse-mcp (或你想要的名字)

   Framework Preset: Next.js (自动检测)

   Root Directory: apps/web (重要！点击 "Edit" 选择)

   Build Command: pnpm build (自动检测)

   Output Directory: .next (自动检测)

   Install Command: pnpm install (自动检测)
   ```

4. **先不要添加环境变量**，点击 **"Deploy"**
   - 第一次部署会失败（因为缺少环境变量）
   - 这是正常的，我们接下来配置

### 1.2 获取 Vercel 部署域名

部署后（即使失败），你会得到一个 Vercel 域名：
```
https://browse-mcp-xxxxx.vercel.app
```

**记下这个域名**，后面配置 GitHub OAuth 需要用！

---

## 🔐 第二步：创建 GitHub OAuth App

### 2.1 创建 OAuth Application

1. **打开 GitHub Developer Settings**
   - 访问：https://github.com/settings/developers
   - 点击左侧 **"OAuth Apps"**
   - 点击 **"New OAuth App"**

2. **填写应用信息**

   ```
   Application name: Browse MCP

   Homepage URL: https://browse-mcp-xxxxx.vercel.app
   (替换成你的 Vercel 域名)

   Application description: Browse MCP Platform (可选)

   Authorization callback URL: https://browse-mcp-xxxxx.vercel.app/api/auth/github/callback
   (重要！必须精确匹配，注意 /api/auth/github/callback 路径)
   ```

3. **创建应用**
   - 点击 **"Register application"**
   - 你会看到 **Client ID**（以 `Iv1.` 开头）

4. **生成 Client Secret**
   - 在应用页面，点击 **"Generate a new client secret"**
   - **立即复制并保存** Client Secret（只显示一次！）

### 2.2 记录凭证

创建一个临时文本文件保存：

```bash
# GitHub OAuth 凭证（保密！）
GITHUB_CLIENT_ID=Iv1.abc123xyz456
GITHUB_CLIENT_SECRET=ghp_abc123def456ghi789...
VERCEL_DOMAIN=https://browse-mcp-xxxxx.vercel.app
```

---

## ⚙️ 第三步：配置 Vercel 环境变量

### 3.1 进入项目设置

1. 在 Vercel Dashboard，进入你的项目
2. 点击顶部 **"Settings"** 标签
3. 点击左侧 **"Environment Variables"**

### 3.2 添加所有环境变量

**重要：每个变量都要勾选 Production、Preview、Development 三个环境！**

逐个添加以下变量：

#### 1. 数据库配置

```
Key: POSTGRES_URL
Value: postgresql://neondb_owner:xxx
Environments: ✓ Production  ✓ Preview  ✓ Development
```

#### 2. 认证密钥

生成两个 32 字节密钥：

```bash
# 在本地终端运行
openssl rand -base64 32
# 复制输出，作为 JWE_SECRET

openssl rand -base64 32
# 复制输出，作为 ENCRYPTION_KEY
```

然后添加：

```
Key: JWE_SECRET
Value: <刚才生成的第一个密钥>
Environments: ✓ Production  ✓ Preview  ✓ Development

Key: ENCRYPTION_KEY
Value: <刚才生成的第二个密钥>
Environments: ✓ Production  ✓ Preview  ✓ Development
```

#### 3. GitHub OAuth

```
Key: NEXT_PUBLIC_GITHUB_CLIENT_ID
Value: Iv1.abc123xyz456  (你的 GitHub Client ID)
Environments: ✓ Production  ✓ Preview  ✓ Development

Key: GITHUB_CLIENT_SECRET
Value: ghp_abc123def456...  (你的 GitHub Client Secret)
Environments: ✓ Production  ✓ Preview  ✓ Development
```

#### 4. 应用 URL

```
Key: NEXT_PUBLIC_APP_URL
Value: https://browse-mcp-xxxxx.vercel.app  (你的 Vercel 域名)
Environments: ✓ Production  ✓ Preview  ✓ Development
```

#### 5. HuggingFace 存储（可选，如果有）

```
Key: HF_TOKEN
Value: hf_your_token_here
Environments: ✓ Production  ✓ Preview  ✓ Development

Key: HF_NAMESPACE
Value: your-username-or-org
Environments: ✓ Production  ✓ Preview  ✓ Development
```

#### 6. Node 环境

```
Key: NODE_ENV
Value: production
Environments: ✓ Production only
```

### 3.3 确认所有变量

检查列表（必需的最小配置）：

- [x] POSTGRES_URL
- [x] JWE_SECRET
- [x] ENCRYPTION_KEY
- [x] NEXT_PUBLIC_GITHUB_CLIENT_ID
- [x] GITHUB_CLIENT_SECRET
- [x] NEXT_PUBLIC_APP_URL
- [x] NODE_ENV (仅 Production)

---

## 🔄 第四步：重新部署

### 4.1 触发新部署

有两种方式：

**方式 A：从 Vercel Dashboard 重新部署**
1. 回到项目的 **"Deployments"** 标签
2. 找到最新的部署
3. 点击右侧 **"..."** → **"Redeploy"**
4. 选择 **"Redeploy"**（保持环境变量）

**方式 B：从 Git 推送触发**
```bash
# 随便做个小改动触发部署
git commit --allow-empty -m "chore: trigger Vercel deployment"
git push
```

### 4.2 等待部署完成

- 部署通常需要 2-5 分钟
- 在 Vercel Dashboard 可以看到实时日志
- 等待状态变为 **"Ready"**

---

## ✅ 第五步：测试 GitHub 登录

### 5.1 访问网站

打开你的 Vercel 域名：
```
https://browse-mcp-xxxxx.vercel.app
```

### 5.2 测试登录流程

1. **访问登录页面**
   - 点击 **"Login"** 或直接访问 `/login`

2. **点击 "Continue with GitHub"**
   - 应该会跳转到 GitHub 授权页面
   - URL 应该是 `https://github.com/login/oauth/authorize?client_id=...`

3. **授权应用**
   - 在 GitHub 页面点击 **"Authorize"**
   - 如果是第一次，会看到权限说明：
     ```
     Browse MCP would like to:
     - Read your user profile information
     - Access your email addresses
     ```

4. **完成登录**
   - 授权后会跳转回你的应用
   - 应该跳转到 `/mcp` 页面
   - 右上角应该显示你的 GitHub 头像和用户名

### 5.3 验证数据库

（可选）检查数据是否正确保存：

```bash
# 在本地连接数据库
export POSTGRES_URL='postgresql://neondb_owner:xxx'

# 启动 Drizzle Studio
cd apps/web
pnpm db:studio
```

打开 http://localhost:4983，检查：
- `users` 表应该有你的记录
- `oauth_connections` 表应该有 GitHub 连接记录

---

## 🛠️ 常见问题排查

### 问题 1：点击 "Continue with GitHub" 后报错 "GitHub OAuth not configured"

**原因**：`NEXT_PUBLIC_GITHUB_CLIENT_ID` 未设置或未生效

**解决方案**：
1. 确认在 Vercel Settings → Environment Variables 中添加了该变量
2. 确认勾选了 Production 环境
3. 重新部署（必须！环境变量改变后需要重新部署）

### 问题 2：GitHub 授权后跳转错误 "Redirect URI mismatch"

**原因**：GitHub OAuth App 的 Callback URL 配置错误

**解决方案**：
1. 检查 GitHub OAuth App 设置
2. Callback URL 必须精确匹配：
   ```
   https://browse-mcp-xxxxx.vercel.app/api/auth/github/callback
   ```
3. 注意：
   - 必须是 `https://`（不是 `http://`）
   - 域名完全匹配
   - 路径是 `/api/auth/github/callback`（不要漏掉或写错）
   - 没有尾部斜杠

### 问题 3：授权后报错 "invalid_state"

**原因**：CSRF 保护触发，state 参数不匹配

**可能原因**：
- Cookie 设置问题
- `NEXT_PUBLIC_APP_URL` 配置错误
- 多次点击授权按钮

**解决方案**：
1. 清除浏览器 Cookie
2. 确认 `NEXT_PUBLIC_APP_URL` 设置正确
3. 重新尝试登录

### 问题 4：授权后报错 "No database connection string"

**原因**：`POSTGRES_URL` 未设置

**解决方案**：
1. 在 Vercel 添加 `POSTGRES_URL` 环境变量
2. 确保勾选了 Production 环境
3. 重新部署

### 问题 5：授权后报错 "relation 'users' does not exist"

**原因**：数据库表未创建

**解决方案**：
```bash
# 在本地推送 schema 到数据库
export POSTGRES_URL='postgresql://neondb_owner:xxx'
cd apps/web
pnpm db:push
```

### 问题 6：部署失败 - Build Error

**查看详细日志**：
1. Vercel Dashboard → Deployments
2. 点击失败的部署
3. 查看 "Build Logs"

**常见原因**：
- TypeScript 类型错误 → 运行 `pnpm type-check` 本地检查
- ESLint 错误 → 运行 `pnpm lint` 本地检查
- 缺少依赖 → 检查 `package.json`

---

## 📝 部署后的配置检查清单

部署成功后，完整检查：

### Vercel 配置检查
- [ ] Root Directory 设置为 `apps/web`
- [ ] 所有环境变量已添加
- [ ] 环境变量勾选了正确的环境（Production）
- [ ] 部署状态显示 "Ready"

### GitHub OAuth App 检查
- [ ] Homepage URL 是你的 Vercel 域名
- [ ] Callback URL 精确匹配：`https://your-domain.vercel.app/api/auth/github/callback`
- [ ] Client ID 和 Secret 已保存并添加到 Vercel

### 功能测试检查
- [ ] 网站可以正常访问
- [ ] 登录页面显示 "Continue with GitHub" 按钮
- [ ] 点击按钮跳转到 GitHub 授权页面
- [ ] 授权后成功跳转回网站
- [ ] 显示用户头像和用户名
- [ ] 数据库中有用户记录

---

## 🎯 快速命令参考

```bash
# 生成密钥
openssl rand -base64 32

# 本地测试构建
cd apps/web
pnpm build

# 推送数据库 schema
export POSTGRES_URL='your-neon-url'
pnpm db:push

# 查看数据库
pnpm db:studio

# 触发重新部署
git commit --allow-empty -m "chore: redeploy"
git push

# 查看 Vercel 日志（需要 Vercel CLI）
npm i -g vercel
vercel logs
```

---

## 🔗 重要链接

| 服务 | URL | 用途 |
|------|-----|------|
| Vercel Dashboard | https://vercel.com/dashboard | 管理部署 |
| GitHub OAuth Apps | https://github.com/settings/developers | 管理 OAuth App |
| Neon Dashboard | https://console.neon.tech | 管理数据库 |
| Vercel 文档 | https://vercel.com/docs | 部署文档 |

---

## 📞 需要帮助？

如果遇到问题：

1. **查看 Vercel 部署日志**
   - Dashboard → Deployments → 点击部署 → Build Logs / Function Logs

2. **查看浏览器控制台**
   - F12 → Console / Network 标签
   - 查看错误信息和网络请求

3. **检查环境变量**
   - Vercel Settings → Environment Variables
   - 确保所有必需变量都已添加

4. **参考文档**
   - `.trellis/spec/deployment-vercel.md` - Vercel 部署文档
   - `.trellis/spec/github-oauth-integration.md` - GitHub OAuth 详细文档

---

## ✨ 下一步

部署成功后，你可以：

1. **绑定自定义域名**
   - Vercel Settings → Domains
   - 添加你的域名
   - 更新 GitHub OAuth App 的 URLs

2. **配置 CI/CD**
   - Vercel 已自动配置
   - 每次 `git push` 会自动部署

3. **监控和日志**
   - Vercel Dashboard → Analytics
   - 查看访问量和性能

4. **配置其他功能**
   - HuggingFace 存储（包上传下载）
   - 邮件通知
   - 其他 OAuth 提供商

---

**祝部署顺利！🚀**
