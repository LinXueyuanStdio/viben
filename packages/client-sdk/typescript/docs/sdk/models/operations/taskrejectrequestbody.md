# TaskRejectRequestBody

## Example Usage

```typescript
import { TaskRejectRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskRejectRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |
| `taskId`                        | *string*                        | :heavy_check_mark:              | Task ID or directory (required) |
| `reason`                        | *string*                        | :heavy_minus_sign:              | Optional rejection reason       |