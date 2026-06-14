# PostApiTaskRejectRequestBody

## Example Usage

```typescript
import { PostApiTaskRejectRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskRejectRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `reason`                        | *string*                        | :heavy_minus_sign:              | Optional rejection reason       |
| `taskId`                        | *string*                        | :heavy_check_mark:              | Task ID or directory (required) |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |