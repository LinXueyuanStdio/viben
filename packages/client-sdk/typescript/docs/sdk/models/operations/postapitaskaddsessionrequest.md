# PostApiTaskAddSessionRequest

## Example Usage

```typescript
import { PostApiTaskAddSessionRequest } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskAddSessionRequest = {
  requestBody: {
    title: "<value>",
  },
  workspacePath: "<value>",
};
```

## Fields

| Field                                                                                                             | Type                                                                                                              | Required                                                                                                          | Description                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `requestBody`                                                                                                     | [operations.PostApiTaskAddSessionRequestBody](../../../sdk/models/operations/postapitaskaddsessionrequestbody.md) | :heavy_check_mark:                                                                                                | N/A                                                                                                               |
| `workspacePath`                                                                                                   | *string*                                                                                                          | :heavy_check_mark:                                                                                                | Workspace path (required)                                                                                         |