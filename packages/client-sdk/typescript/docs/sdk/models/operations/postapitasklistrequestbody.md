# PostApiTaskListRequestBody

## Example Usage

```typescript
import { PostApiTaskListRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskListRequestBody = {
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `mine`                    | *boolean*                 | :heavy_minus_sign:        | Show only my tasks        |
| `status`                  | *string*                  | :heavy_minus_sign:        | Filter by status          |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |