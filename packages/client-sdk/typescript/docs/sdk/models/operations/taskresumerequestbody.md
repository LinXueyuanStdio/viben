# TaskResumeRequestBody

## Example Usage

```typescript
import { TaskResumeRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskResumeRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |
| `taskId`                        | *string*                        | :heavy_check_mark:              | Task ID or directory (required) |