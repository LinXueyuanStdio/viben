# TaskCreateAddSessionRequest

## Example Usage

```typescript
import { TaskCreateAddSessionRequest } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateAddSessionRequest = {
  workspacePath: "<value>",
  requestBody: {
    title: "<value>",
  },
};
```

## Fields

| Field                                                                                                           | Type                                                                                                            | Required                                                                                                        | Description                                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `workspacePath`                                                                                                 | *string*                                                                                                        | :heavy_check_mark:                                                                                              | Workspace path (required)                                                                                       |
| `requestBody`                                                                                                   | [operations.TaskCreateAddSessionRequestBody](../../../sdk/models/operations/taskcreateaddsessionrequestbody.md) | :heavy_check_mark:                                                                                              | N/A                                                                                                             |