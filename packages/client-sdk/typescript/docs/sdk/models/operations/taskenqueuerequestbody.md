# TaskEnqueueRequestBody

## Example Usage

```typescript
import { TaskEnqueueRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskEnqueueRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                                     | Type                                      | Required                                  | Description                               |
| ----------------------------------------- | ----------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| `workspacePath`                           | *string*                                  | :heavy_check_mark:                        | Workspace path (required)                 |
| `taskId`                                  | *string*                                  | :heavy_check_mark:                        | Task ID or directory (required)           |
| `agent`                                   | *string*                                  | :heavy_minus_sign:                        | Agent ID to execute this task             |
| `executor`                                | *string*                                  | :heavy_minus_sign:                        | Executor type (CLAUDE_CODE, CURSOR, etc.) |
| `model`                                   | *string*                                  | :heavy_minus_sign:                        | Model ID for execution                    |
| `priority`                                | *string*                                  | :heavy_minus_sign:                        | Priority (urgent/high/medium/low/none)    |