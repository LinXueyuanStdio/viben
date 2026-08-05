# TaskCreateSetAgentRequestBody

## Example Usage

```typescript
import { TaskCreateSetAgentRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateSetAgentRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
  agentId: "<id>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `taskId`                  | *string*                  | :heavy_check_mark:        | Task ID or directory      |
| `agentId`                 | *string*                  | :heavy_check_mark:        | Agent ID to associate     |