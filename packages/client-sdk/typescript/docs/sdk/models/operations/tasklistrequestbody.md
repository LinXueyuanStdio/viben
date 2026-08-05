# TaskListRequestBody

## Example Usage

```typescript
import { TaskListRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskListRequestBody = {
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `mine`                    | *boolean*                 | :heavy_minus_sign:        | Show only my tasks        |
| `status`                  | *string*                  | :heavy_minus_sign:        | Filter by status          |