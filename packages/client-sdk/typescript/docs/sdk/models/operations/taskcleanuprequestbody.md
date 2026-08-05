# TaskCleanupRequestBody

## Example Usage

```typescript
import { TaskCleanupRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCleanupRequestBody = {
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `branch`                  | *string*                  | :heavy_minus_sign:        | Branch name to cleanup    |
| `keepBranch`              | *boolean*                 | :heavy_minus_sign:        | Keep the git branch       |
| `merged`                  | *boolean*                 | :heavy_minus_sign:        | Cleanup merged worktrees  |
| `all`                     | *boolean*                 | :heavy_minus_sign:        | Cleanup all worktrees     |
| `list`                    | *boolean*                 | :heavy_minus_sign:        | List all worktrees        |