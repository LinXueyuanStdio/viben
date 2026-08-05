# TaskCreateFinishRequestBody

## Example Usage

```typescript
import { TaskCreateFinishRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateFinishRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |
| `taskId`                        | *string*                        | :heavy_check_mark:              | Task ID or directory (required) |