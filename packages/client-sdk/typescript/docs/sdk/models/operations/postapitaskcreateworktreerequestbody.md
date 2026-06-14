# PostApiTaskCreateWorktreeRequestBody

## Example Usage

```typescript
import { PostApiTaskCreateWorktreeRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskCreateWorktreeRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `skipPrd`                       | *boolean*                       | :heavy_minus_sign:              | Skip prd.md validation          |
| `taskId`                        | *string*                        | :heavy_check_mark:              | Task ID or directory (required) |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |