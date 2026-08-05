# IdeasPromoteRequestBody

## Example Usage

```typescript
import { IdeasPromoteRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: IdeasPromoteRequestBody = {
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `slug`                    | *string*                  | :heavy_minus_sign:        | Task slug                 |
| `priority`                | *string*                  | :heavy_minus_sign:        | Task priority             |
| `assignee`                | *string*                  | :heavy_minus_sign:        | Task assignee             |
| `branch`                  | *string*                  | :heavy_minus_sign:        | Custom branch name        |
| `description`             | *string*                  | :heavy_minus_sign:        | Task description override |
| `agent`                   | *string*                  | :heavy_minus_sign:        | Agent configuration       |
| `executor`                | *string*                  | :heavy_minus_sign:        | Executor type             |
| `model`                   | *string*                  | :heavy_minus_sign:        | Model to use              |
| `start`                   | *boolean*                 | :heavy_minus_sign:        | Auto-start task           |
| `worktree`                | *boolean*                 | :heavy_minus_sign:        | Run in worktree           |