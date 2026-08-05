# TaskListExecutionStreamRequest

## Example Usage

```typescript
import { TaskListExecutionStreamRequest } from "@viben/client-sdk/sdk/models/operations";

let value: TaskListExecutionStreamRequest = {
  workspacePath: "<value>",
  taskDir: "<value>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |
| `taskDir`                       | *string*                        | :heavy_check_mark:              | Task directory or ID (required) |