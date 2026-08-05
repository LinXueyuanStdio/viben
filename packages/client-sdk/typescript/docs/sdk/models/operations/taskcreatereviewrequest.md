# TaskCreateReviewRequest

## Example Usage

```typescript
import { TaskCreateReviewRequest } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateReviewRequest = {
  taskDir: "<value>",
};
```

## Fields

| Field                          | Type                           | Required                       | Description                    |
| ------------------------------ | ------------------------------ | ------------------------------ | ------------------------------ |
| `workspacePath`                | *string*                       | :heavy_minus_sign:             | Workspace path                 |
| `taskDir`                      | *string*                       | :heavy_check_mark:             | Task directory path (required) |