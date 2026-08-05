# TaskCreateContextRequest

## Example Usage

```typescript
import { TaskCreateContextRequest } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateContextRequest = {
  workspacePath: "<value>",
  requestBody: {},
};
```

## Fields

| Field                                                                                                     | Type                                                                                                      | Required                                                                                                  | Description                                                                                               |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `workspacePath`                                                                                           | *string*                                                                                                  | :heavy_check_mark:                                                                                        | Workspace path (required)                                                                                 |
| `taskDir`                                                                                                 | *string*                                                                                                  | :heavy_minus_sign:                                                                                        | Task directory (optional, for current task info)                                                          |
| `requestBody`                                                                                             | [operations.TaskCreateContextRequestBody](../../../sdk/models/operations/taskcreatecontextrequestbody.md) | :heavy_check_mark:                                                                                        | N/A                                                                                                       |