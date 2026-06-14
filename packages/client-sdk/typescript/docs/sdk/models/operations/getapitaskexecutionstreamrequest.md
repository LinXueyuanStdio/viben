# GetApiTaskExecutionStreamRequest

## Example Usage

```typescript
import { GetApiTaskExecutionStreamRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiTaskExecutionStreamRequest = {
  taskDir: "<value>",
  workspacePath: "<value>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `taskDir`                       | *string*                        | :heavy_check_mark:              | Task directory or ID (required) |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |