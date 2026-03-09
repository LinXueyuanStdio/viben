# 健康检查 API

> `/health` - 服务健康检查端点

## 概述

健康检查端点用于验证 Gateway 服务是否正常运行。

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |

---

## 详细说明

### GET /health

检查服务健康状态。

**响应**:

```json
{
  "status": "ok",
  "service": "viben-gateway",
  "version": "1.0.0",
  "timestamp": "2024-01-16T10:00:00Z",
  "uptime": "running"
}
```

| 字段 | 说明 |
|------|------|
| status | 服务状态 (`ok`) |
| service | 服务名称 |
| version | 版本号 |
| timestamp | 当前时间 |
| uptime | 运行状态 |

---

## 使用示例

```bash
# 检查 Gateway 是否运行
curl http://127.0.0.1:18790/health

# 预期输出
{"status":"ok","service":"viben-gateway","version":"1.0.0",...}
```

---

## 监控集成

健康检查端点适用于：
- 负载均衡器健康检查
- Kubernetes liveness/readiness 探针
- 监控系统状态检测

```yaml
# Kubernetes 探针配置示例
livenessProbe:
  httpGet:
    path: /health
    port: 18790
  initialDelaySeconds: 5
  periodSeconds: 10
```
