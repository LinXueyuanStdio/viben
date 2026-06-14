# PostApiIdeasIdPromoteRequestBody

## Example Usage

```typescript
import { PostApiIdeasIdPromoteRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiIdeasIdPromoteRequestBody = {
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `agent`                   | *string*                  | :heavy_minus_sign:        | Agent configuration       |
| `assignee`                | *string*                  | :heavy_minus_sign:        | Task assignee             |
| `branch`                  | *string*                  | :heavy_minus_sign:        | Custom branch name        |
| `description`             | *string*                  | :heavy_minus_sign:        | Task description override |
| `executor`                | *string*                  | :heavy_minus_sign:        | Executor type             |
| `model`                   | *string*                  | :heavy_minus_sign:        | Model to use              |
| `priority`                | *string*                  | :heavy_minus_sign:        | Task priority             |
| `slug`                    | *string*                  | :heavy_minus_sign:        | Task slug                 |
| `start`                   | *boolean*                 | :heavy_minus_sign:        | Auto-start task           |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `worktree`                | *boolean*                 | :heavy_minus_sign:        | Run in worktree           |