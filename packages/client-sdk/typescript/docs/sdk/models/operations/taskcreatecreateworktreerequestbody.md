# TaskCreateCreateWorktreeRequestBody

## Example Usage

```typescript
import { TaskCreateCreateWorktreeRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateCreateWorktreeRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |
| `taskId`                        | *string*                        | :heavy_check_mark:              | Task ID or directory (required) |
| `skipPrd`                       | *boolean*                       | :heavy_minus_sign:              | Skip prd.md validation          |