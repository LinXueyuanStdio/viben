# TaskExecuteRequestBody

## Example Usage

```typescript
import { TaskExecuteRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskExecuteRequestBody = {
  workspacePath: "<value>",
  taskDir: "<value>",
};
```

## Fields

| Field                                                                     | Type                                                                      | Required                                                                  | Description                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `workspacePath`                                                           | *string*                                                                  | :heavy_check_mark:                                                        | Workspace path (required)                                                 |
| `taskDir`                                                                 | *string*                                                                  | :heavy_check_mark:                                                        | Task directory path or ID (required)                                      |
| `agentId`                                                                 | *string*                                                                  | :heavy_minus_sign:                                                        | Agent ID to use                                                           |
| `input`                                                                   | *string*                                                                  | :heavy_minus_sign:                                                        | User prompt                                                               |
| `cwd`                                                                     | *string*                                                                  | :heavy_minus_sign:                                                        | Working directory                                                         |
| `agentConfigPath`                                                         | *string*                                                                  | :heavy_minus_sign:                                                        | Path to agent config                                                      |
| `resumeSession`                                                           | *string*                                                                  | :heavy_minus_sign:                                                        | Resume from existing session                                              |
| `maxRetries`                                                              | *number*                                                                  | :heavy_minus_sign:                                                        | Maximum retry attempts                                                    |
| `attachments`                                                             | [operations.Attachments](../../../sdk/models/operations/attachments.md)[] | :heavy_minus_sign:                                                        | N/A                                                                       |