# PostApiTaskPlanRequest

## Example Usage

```typescript
import { PostApiTaskPlanRequest } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskPlanRequest = {
  requestBody: {
    name: "<value>",
    requirement: "<value>",
  },
  workspacePath: "<value>",
};
```

## Fields

| Field                                                                                                 | Type                                                                                                  | Required                                                                                              | Description                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `requestBody`                                                                                         | [operations.PostApiTaskPlanRequestBody](../../../sdk/models/operations/postapitaskplanrequestbody.md) | :heavy_check_mark:                                                                                    | N/A                                                                                                   |
| `workspacePath`                                                                                       | *string*                                                                                              | :heavy_check_mark:                                                                                    | Workspace path (required)                                                                             |