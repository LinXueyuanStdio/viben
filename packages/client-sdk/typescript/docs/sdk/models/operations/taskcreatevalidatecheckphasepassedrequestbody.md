# TaskCreateValidateCheckPhasePassedRequestBody

## Example Usage

```typescript
import { TaskCreateValidateCheckPhasePassedRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateValidateCheckPhasePassedRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                                                 | Type                                                  | Required                                              | Description                                           |
| ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `workspacePath`                                       | *string*                                              | :heavy_check_mark:                                    | Workspace path (required)                             |
| `taskId`                                              | *string*                                              | :heavy_check_mark:                                    | Task ID or directory (required)                       |
| `output`                                              | *string*                                              | :heavy_minus_sign:                                    | Agent output text (for completion markers validation) |
| `outputFile`                                          | *string*                                              | :heavy_minus_sign:                                    | File containing agent output                          |