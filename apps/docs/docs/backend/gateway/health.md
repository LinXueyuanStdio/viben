# Health Check API

> `/health` - Service health check endpoint

## Overview

The health check endpoint is used to verify that the Gateway service is running properly.

## Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |

---

## Detailed Description

### GET /health

Check service health status.

**Response**:

```json
{
  "status": "ok",
  "service": "viben-gateway",
  "version": "1.0.0",
  "timestamp": "2024-01-16T10:00:00Z",
  "uptime": "running"
}
```

| Field | Description |
|-------|-------------|
| status | Service status (`ok`) |
| service | Service name |
| version | Version number |
| timestamp | Current time |
| uptime | Running status |

---

## Usage Example

```bash
# Check if Gateway is running
curl http://127.0.0.1:18790/health

# Expected output
{"status":"ok","service":"viben-gateway","version":"1.0.0",...}
```

---

## Monitoring Integration

The health check endpoint is suitable for:
- Load balancer health checks
- Kubernetes liveness/readiness probes
- Monitoring system status detection

```yaml
# Kubernetes probe configuration example
livenessProbe:
  httpGet:
    path: /health
    port: 18790
  initialDelaySeconds: 5
  periodSeconds: 10
```
