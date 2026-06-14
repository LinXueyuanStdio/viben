# PostApiTaskSetAgentRequestBody

## Example Usage

```typescript
import { PostApiTaskSetAgentRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskSetAgentRequestBody = {
  agentId: "<id>",
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `agentId`                 | *string*                  | :heavy_check_mark:        | Agent ID to associate     |
| `taskId`                  | *string*                  | :heavy_check_mark:        | Task ID or directory      |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |