# PostApiTaskApproveRequestBody

## Example Usage

```typescript
import { PostApiTaskApproveRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskApproveRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `comment`                       | *string*                        | :heavy_minus_sign:              | Optional approval comment       |
| `taskId`                        | *string*                        | :heavy_check_mark:              | Task ID or directory (required) |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |