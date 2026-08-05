# TaskStopRequestBody

## Example Usage

```typescript
import { TaskStopRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskStopRequestBody = {
  workspacePath: "<value>",
  taskDir: "<value>",
};
```

## Fields

| Field                                | Type                                 | Required                             | Description                          |
| ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| `workspacePath`                      | *string*                             | :heavy_check_mark:                   | Workspace path (required)            |
| `taskDir`                            | *string*                             | :heavy_check_mark:                   | Task directory path or ID (required) |