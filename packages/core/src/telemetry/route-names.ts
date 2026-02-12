/**
 * 端点中文名映射
 *
 * 为每个 API 端点提供人类可读的中文名称，用于可观测性追踪
 */

export const ROUTE_NAMES: Record<string, string> = {
  // 健康检查
  "GET /health": "健康检查",
  "GET /api/health": "API健康检查",

  // 智能体
  "GET /api/agents": "获取智能体列表",
  "GET /api/agents/:id": "获取智能体详情",
  "POST /api/agents": "创建智能体",
  "PUT /api/agents/:id": "更新智能体",
  "PATCH /api/agents/:id": "部分更新智能体",
  "DELETE /api/agents/:id": "删除智能体",
  "POST /api/agents/:id/run": "运行智能体",
  "POST /api/agents/:id/stop": "停止智能体",
  "GET /api/agents/:id/sessions": "获取智能体会话列表",
  "GET /api/agents/:id/status": "获取智能体状态",

  // 智能体运行
  "POST /api/agent-run": "执行智能体任务",
  "POST /api/agent-run/stream": "流式执行智能体任务",

  // 会话
  "GET /api/sessions": "获取会话列表",
  "GET /api/sessions/:id": "获取会话详情",
  "GET /api/sessions/:id/messages": "获取会话消息",
  "POST /api/sessions/:id/messages": "发送消息",
  "DELETE /api/sessions/:id": "删除会话",

  // 任务
  "GET /api/tasks": "获取任务列表",
  "GET /api/tasks/:id": "获取任务详情",
  "POST /api/tasks": "创建任务",
  "PUT /api/tasks/:id": "更新任务",
  "DELETE /api/tasks/:id": "删除任务",

  // 工作区
  "GET /api/workspaces": "获取工作区列表",
  "GET /api/workspaces/:id": "获取工作区详情",
  "POST /api/workspaces": "创建工作区",
  "PUT /api/workspaces/:id": "更新工作区",
  "DELETE /api/workspaces/:id": "删除工作区",
  "GET /api/workspaces/:id/files": "获取工作区文件",

  // 文件
  "GET /api/files": "读取文件",
  "POST /api/files": "写入文件",
  "PUT /api/files": "更新文件",
  "DELETE /api/files": "删除文件",
  "GET /api/files/list": "列出目录",
  "POST /api/files/mkdir": "创建目录",
  "GET /api/files/stat": "获取文件状态",
  "POST /api/files/move": "移动文件",
  "POST /api/files/copy": "复制文件",

  // Provider
  "GET /api/providers": "获取Provider列表",
  "GET /api/providers/:id": "获取Provider详情",
  "POST /api/providers": "创建Provider",
  "PUT /api/providers/:id": "更新Provider",
  "DELETE /api/providers/:id": "删除Provider",
  "POST /api/providers/:id/test": "测试Provider连接",

  // 模型
  "GET /api/models": "获取模型列表",
  "GET /api/models/:id": "获取模型详情",
  "POST /api/models": "创建模型",
  "PUT /api/models/:id": "更新模型",
  "DELETE /api/models/:id": "删除模型",

  // 定时任务
  "GET /api/cron": "获取定时任务列表",
  "GET /api/cron/:id": "获取定时任务详情",
  "POST /api/cron": "创建定时任务",
  "PUT /api/cron/:id": "更新定时任务",
  "DELETE /api/cron/:id": "删除定时任务",
  "POST /api/cron/:id/trigger": "手动触发定时任务",

  // 渠道
  "GET /api/channels": "获取渠道列表",
  "GET /api/channels/:id": "获取渠道详情",
  "POST /api/channels": "创建渠道",
  "PUT /api/channels/:id": "更新渠道",
  "DELETE /api/channels/:id": "删除渠道",
  "POST /api/channels/:id/test": "测试渠道连接",

  // 执行器
  "GET /api/executors": "获取执行器列表",
  "GET /api/executors/:id": "获取执行器详情",
  "POST /api/executors/:id/execute": "执行执行器",

  // 群聊
  "GET /api/group-chats": "获取群聊列表",
  "GET /api/group-chats/:id": "获取群聊详情",
  "POST /api/group-chats": "创建群聊",
  "PUT /api/group-chats/:id": "更新群聊",
  "DELETE /api/group-chats/:id": "删除群聊",
  "POST /api/group-chats/:id/messages": "发送群聊消息",

  // 对话列表
  "GET /api/chat/list": "获取对话列表",
  "POST /api/chat/completions": "对话补全",

  // 历史记录
  "GET /api/history": "获取历史记录",
  "GET /api/history/:id": "获取历史详情",
  "DELETE /api/history/:id": "删除历史记录",

  // MCP
  "GET /api/mcp/servers": "获取MCP服务器列表",
  "GET /api/mcp/servers/:id": "获取MCP服务器详情",
  "POST /api/mcp/servers": "创建MCP服务器",
  "DELETE /api/mcp/servers/:id": "删除MCP服务器",
  "GET /api/mcp/servers/:id/tools": "获取MCP工具列表",

  // 终端
  "POST /api/terminal": "创建终端会话",
  "GET /api/terminal/:id": "获取终端会话",
  "DELETE /api/terminal/:id": "关闭终端会话",
  "POST /api/terminal/:id/input": "终端输入",
  "POST /api/terminal/:id/resize": "调整终端大小",

  // 事件
  "GET /api/events": "事件流订阅",

  // WebSocket
  "WS /ws": "WebSocket连接",
  "WS /api/ws": "API WebSocket连接",
};

/**
 * 自定义 span 名称映射（非 HTTP 请求的内部操作）
 */
export const SPAN_NAMES: Record<string, string> = {
  // 智能体相关
  "agent.run": "执行智能体",
  "agent.init": "初始化智能体",
  "agent.stop": "停止智能体",
  "agent.cleanup": "清理智能体资源",

  // 会话相关
  "session.create": "创建会话",
  "session.load": "加载会话",
  "session.save": "保存会话",
  "session.message": "处理消息",

  // LLM 调用
  "llm.call": "LLM调用",
  "llm.stream": "LLM流式调用",
  "llm.completion": "LLM补全",

  // 工具执行
  "tool.execute": "执行工具",
  "tool.validate": "验证工具参数",

  // 文件操作
  "file.read": "读取文件",
  "file.write": "写入文件",
  "file.delete": "删除文件",
  "file.list": "列出文件",

  // 数据库/存储
  "db.query": "数据库查询",
  "db.write": "数据库写入",
  "cache.get": "缓存读取",
  "cache.set": "缓存写入",

  // MCP 相关
  "mcp.connect": "连接MCP服务器",
  "mcp.disconnect": "断开MCP服务器",
  "mcp.tool_call": "MCP工具调用",

  // Cron 相关
  "cron.execute": "执行定时任务",
  "cron.schedule": "调度定时任务",

  // 渠道相关
  "channel.send": "发送渠道消息",
  "channel.receive": "接收渠道消息",
};

/**
 * 获取端点的中文名称
 *
 * @param method - HTTP 方法
 * @param route - 路由路径
 * @returns 中文名称，如果没有映射则返回原始路由
 */
export function getRouteName(method: string, route: string): string {
  const key = `${method} ${route}`;
  return ROUTE_NAMES[key] || `${method} ${route}`;
}

/**
 * 获取 span 的中文名称
 *
 * @param spanName - span 名称
 * @returns 中文名称，如果没有映射则返回原始名称
 */
export function getSpanName(spanName: string): string {
  return SPAN_NAMES[spanName] || spanName;
}
