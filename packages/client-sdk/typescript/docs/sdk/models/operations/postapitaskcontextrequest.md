# PostApiTaskContextRequest

## Example Usage

```typescript
import { PostApiTaskContextRequest } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskContextRequest = {
  requestBody: {},
  workspacePath: "<value>",
};
```

## Fields

| Field                                                                                                       | Type                                                                                                        | Required                                                                                                    | Description                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `requestBody`                                                                                               | [operations.PostApiTaskContextRequestBody](../../../sdk/models/operations/postapitaskcontextrequestbody.md) | :heavy_check_mark:                                                                                          | N/A                                                                                                         |
| `taskDir`                                                                                                   | *string*                                                                                                    | :heavy_minus_sign:                                                                                          | Task directory (optional, for current task info)                                                            |
| `workspacePath`                                                                                             | *string*                                                                                                    | :heavy_check_mark:                                                                                          | Workspace path (required)                                                                                   |