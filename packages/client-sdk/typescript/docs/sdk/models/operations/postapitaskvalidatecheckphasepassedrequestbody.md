# PostApiTaskValidateCheckPhasePassedRequestBody

## Example Usage

```typescript
import { PostApiTaskValidateCheckPhasePassedRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskValidateCheckPhasePassedRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                                 | Type                                                  | Required                                              | Description                                           |
| ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `output`                                              | *string*                                              | :heavy_minus_sign:                                    | Agent output text (for completion markers validation) |
| `outputFile`                                          | *string*                                              | :heavy_minus_sign:                                    | File containing agent output                          |
| `taskId`                                              | *string*                                              | :heavy_check_mark:                                    | Task ID or directory (required)                       |
| `workspacePath`                                       | *string*                                              | :heavy_check_mark:                                    | Workspace path (required)                             |