# TaskRetryRequestBody

## Example Usage

```typescript
import { TaskRetryRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskRetryRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |
| `taskId`                        | *string*                        | :heavy_check_mark:              | Task ID or directory (required) |