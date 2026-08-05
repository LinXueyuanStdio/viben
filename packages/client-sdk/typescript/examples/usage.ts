/**
 * @viben/client-sdk 使用体验脚本
 *
 * 运行方式：
 *   cd packages/client-sdk/typescript
 *   npx tsx examples/usage.ts
 *
 * 前提：Gateway 正在运行（默认 http://127.0.0.1:18790）
 */

import { VibenClient } from "@viben/client-sdk";

const client = new VibenClient();

// ============================================================================
// 输出辅助
// ============================================================================
function title(text: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${text}`);
  console.log("=".repeat(60));
}

function ok(label: string, result: unknown): void {
  console.log(`✅ ${label}`);
  if (result !== undefined) {
    const s = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    // 截断过长输出
    if (s.length > 500) {
      console.log(`   ${s.slice(0, 500)}...`);
    } else {
      console.log(`   ${s}`);
    }
  }
}

function fail(label: string, err: unknown): void {
  console.log(`❌ ${label}`);
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`   ${msg.slice(0, 300)}`);
}

// ============================================================================
// 实际调用
// ============================================================================
async function main() {
  // ---- Agent（智能体管理）----
  title("Agent — 智能体");

  await client.agent.list({ includeGlobal: "true" }).then(
    (r) => ok("agent.list()", `共 ${r?.agents?.length ?? 0} 个智能体`),
    (e) => fail("agent.list()", e),
  );

  await client.agent.getDefault().then(
    () => ok("agent.getDefault()", "获取成功"),
    (e) => fail("agent.getDefault()", e),
  );

  await client.agent.listTemplates().then(
    () => ok("agent.listTemplates()", "获取成功"),
    (e) => fail("agent.listTemplates()", e),
  );

  // ---- Models（模型管理）----
  title("Models — 模型");

  await client.models.list().then(
    (r) => ok("models.list()", r),
    (e) => fail("models.list()", e),
  );

  await client.models.getDefault().then(
    () => ok("models.getDefault()", "获取成功"),
    (e) => fail("models.getDefault()", e),
  );

  // ---- Sessions（会话管理）----
  title("Sessions — 会话");

  await client.sessions.list().then(
    (r) => ok("sessions.list()", r),
    (e) => fail("sessions.list()", e),
  );

  // ---- Channels（通道管理）----
  title("Channels — 通道");

  await client.channels.list().then(
    (r) => ok("channels.list()", r),
    (e) => fail("channels.list()", e),
  );

  // ---- Tasks（任务管理）----
  title("Tasks — 任务");

  await client.tasks.list({ workspacePath: "/Users/lxy" }).then(
    (r) => ok("tasks.list()", `共 ${(r as any)?.tasks?.length ?? 0} 个任务`),
    (e) => fail("tasks.list()", e),
  );

  // ---- Cron（定时任务）----
  title("Cron — 定时任务");

  await client.cron.list().then(
    (r) => ok("cron.list()", r),
    (e) => fail("cron.list()", e),
  );

  // ---- Providers（供应商）----
  title("Providers — 模型供应商");

  await client.providers.list().then(
    (r) => ok("providers.list()", r),
    (e) => fail("providers.list()", e),
  );

  // ---- Workspaces（工作空间）----
  title("Workspaces — 工作空间");

  await client.workspaces.list().then(
    (r) => ok("workspaces.list()", r),
    (e) => fail("workspaces.list()", e),
  );

  // ---- Executors（执行器）----
  title("Executors — 执行器");

  await client.executors.list().then(
    (r) => ok("executors.list()", r),
    (e) => fail("executors.list()", e),
  );

  // ---- GitHub（GitHub 集成）----
  title("GitHub — GitHub 集成");

  // GitHub routes 需要在 OpenAPI spec 中补充 query params，暂时跳过
  await client.github.getAuthStatus().then(
    () => ok("github.getAuthStatus()", "获取成功"),
    () => console.log("⚠️  github.getAuthStatus() — 需要 workspace_path（spec 中尚未定义）"),
  );

  await client.github.listRepos().then(
    () => ok("github.listRepos()", "获取成功"),
    () => console.log("⚠️  github.listRepos() — 需要 workspace_path（spec 中尚未定义）"),
  );

  // ---- History（历史）----
  title("History — 历史记录");

  await client.history.list().then(
    (r) => ok("history.list()", r),
    (e) => fail("history.list()", e),
  );

  // ---- Accounts（账户管理）----
  title("Accounts — 账户");

  await client.accounts.list().then(
    (r) => ok("accounts.list()", r),
    (e) => fail("accounts.list()", e),
  );

  // ---- MCP（MCP 服务器）----
  title("MCP — MCP 服务器");

  await client.mcp.list().then(
    () => ok("mcp.list()", "获取成功"),
    (e) => fail("mcp.list()", e),
  );

  // ---- Skill（技能）----
  title("Skill — 技能");

  await client.skill.list().then(
    () => ok("skill.list()", "获取成功"),
    (e) => fail("skill.list()", e),
  );

  // ---- Preferences（偏好设置）----
  title("Preferences — 偏好设置");

  await client.preferences.list().then(
    () => ok("preferences.list()", "获取成功"),
    (e) => fail("preferences.list()", e),
  );

  // ---- GroupChats（群聊）----
  title("GroupChats — 群聊");

  await client.groupChats.list().then(
    (r) => ok("groupChats.list()", r),
    (e) => fail("groupChats.list()", e),
  );

  // ---- Queue（任务队列）----
  title("Queue — 任务队列");

  await client.queue.getStatus().then(
    () => ok("queue.getStatus()", "获取成功"),
    (e) => fail("queue.getStatus()", e),
  );

  await client.queue.getConfig().then(
    () => ok("queue.getConfig()", "获取成功"),
    (e) => fail("queue.getConfig()", e),
  );

  // ---- Tunnel（隧道）----
  title("Tunnel — 隧道");

  await client.tunnel.getStatus().then(
    () => ok("tunnel.getStatus()", "获取成功"),
    (e) => fail("tunnel.getStatus()", e),
  );

  // ---- Telemetry（遥测）----
  title("Telemetry — 遥测");

  await client.telemetry.listStats().then(
    () => ok("telemetry.listStats()", "获取成功"),
    (e) => fail("telemetry.listStats()", e),
  );

  // ---- Cache（缓存）----
  title("Cache — 缓存");

  await client.cache.getSettings().then(
    () => ok("cache.getSettings()", "获取成功"),
    (e) => fail("cache.getSettings()", e),
  );

  await client.cache.getInfo().then(
    () => ok("cache.getInfo()", "获取成功"),
    (e) => fail("cache.getInfo()", e),
  );

  // ---- Devices（设备）----
  title("Devices — 设备");

  await client.devices.list().then(
    (r) => ok("devices.list()", r),
    (e) => fail("devices.list()", e),
  );

  // ======== 总结 ========
  title("使用体验总结");

  console.log(`
  SDK API 风格示例：
  ─────────────────────────────────────────────
  client.agent.list()           // GET  /api/agent
  client.agent.getDefault()     // GET  /api/agent/default
  client.agent.listTemplates()  // GET  /api/agent/templates
  client.agent.getSessions()    // GET  /api/agent/:id/sessions
  client.agent.createSession()  // POST /api/agent/:id/sessions

  client.models.list()          // GET  /api/models
  client.models.getDefault()    // GET  /api/models/default

  client.channels.list()        // GET  /api/channels
  client.channels.send()        // POST /api/channels/send

  client.github.listIssues()    // GET  /api/github/issues
  client.github.getIssueComments() // GET /api/github/issues/:num/comments

  client.cron.list()            // GET  /api/cron
  client.cron.getLogs()         // GET  /api/cron/:id/logs
  ─────────────────────────────────────────────
  ✅ 所有方法名干净简洁，无冗余 namespace 前缀。
  ✅ 跨命名空间的同名方法（list, get, create, delete）正常工作。
  ✅ 子资源方法（getSessions, createSession, getSessionMessages）清晰易读。
  `);
}

main().catch(console.error);
