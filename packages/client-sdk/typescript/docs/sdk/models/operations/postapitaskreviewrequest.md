# PostApiTaskReviewRequest

## Example Usage

```typescript
import { PostApiTaskReviewRequest } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskReviewRequest = {
  taskDir: "<value>",
};
```

## Fields

| Field                          | Type                           | Required                       | Description                    |
| ------------------------------ | ------------------------------ | ------------------------------ | ------------------------------ |
| `taskDir`                      | *string*                       | :heavy_check_mark:             | Task directory path (required) |
| `workspacePath`                | *string*                       | :heavy_minus_sign:             | Workspace path                 |