# TaskCreatePlanRequest

## Example Usage

```typescript
import { TaskCreatePlanRequest } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreatePlanRequest = {
  workspacePath: "<value>",
  requestBody: {
    name: "<value>",
    requirement: "<value>",
  },
};
```

## Fields

| Field                                                                                               | Type                                                                                                | Required                                                                                            | Description                                                                                         |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `workspacePath`                                                                                     | *string*                                                                                            | :heavy_check_mark:                                                                                  | Workspace path (required)                                                                           |
| `requestBody`                                                                                       | [operations.TaskCreatePlanRequestBody](../../../sdk/models/operations/taskcreateplanrequestbody.md) | :heavy_check_mark:                                                                                  | N/A                                                                                                 |