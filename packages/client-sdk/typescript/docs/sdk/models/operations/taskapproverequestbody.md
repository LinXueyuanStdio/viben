# TaskApproveRequestBody

## Example Usage

```typescript
import { TaskApproveRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskApproveRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |
| `taskId`                        | *string*                        | :heavy_check_mark:              | Task ID or directory (required) |
| `comment`                       | *string*                        | :heavy_minus_sign:              | Optional approval comment       |