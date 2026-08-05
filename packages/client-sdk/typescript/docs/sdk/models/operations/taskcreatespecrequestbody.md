# TaskCreateSpecRequestBody

## Example Usage

```typescript
import { TaskCreateSpecRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateSpecRequestBody = {
  workspacePath: "<value>",
  taskDir: "<value>",
};
```

## Fields

| Field                                | Type                                 | Required                             | Description                          |
| ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| `workspacePath`                      | *string*                             | :heavy_check_mark:                   | Workspace path (required)            |
| `taskDir`                            | *string*                             | :heavy_check_mark:                   | Task directory path or ID (required) |