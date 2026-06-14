# PostApiTaskArchiveRequestBody

## Example Usage

```typescript
import { PostApiTaskArchiveRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskArchiveRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `taskId`                        | *string*                        | :heavy_check_mark:              | Task ID or directory (required) |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |