# PostApiTaskExecuteRequestBody

## Example Usage

```typescript
import { PostApiTaskExecuteRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskExecuteRequestBody = {
  taskDir: "<value>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                                                     | Type                                                                      | Required                                                                  | Description                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `agentConfigPath`                                                         | *string*                                                                  | :heavy_minus_sign:                                                        | Path to agent config                                                      |
| `agentId`                                                                 | *string*                                                                  | :heavy_minus_sign:                                                        | Agent ID to use                                                           |
| `attachments`                                                             | [operations.Attachments](../../../sdk/models/operations/attachments.md)[] | :heavy_minus_sign:                                                        | N/A                                                                       |
| `cwd`                                                                     | *string*                                                                  | :heavy_minus_sign:                                                        | Working directory                                                         |
| `input`                                                                   | *string*                                                                  | :heavy_minus_sign:                                                        | User prompt                                                               |
| `maxRetries`                                                              | *number*                                                                  | :heavy_minus_sign:                                                        | Maximum retry attempts                                                    |
| `resumeSession`                                                           | *string*                                                                  | :heavy_minus_sign:                                                        | Resume from existing session                                              |
| `taskDir`                                                                 | *string*                                                                  | :heavy_check_mark:                                                        | Task directory path or ID (required)                                      |
| `workspacePath`                                                           | *string*                                                                  | :heavy_check_mark:                                                        | Workspace path (required)                                                 |