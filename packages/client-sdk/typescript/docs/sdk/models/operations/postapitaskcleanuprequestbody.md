# PostApiTaskCleanupRequestBody

## Example Usage

```typescript
import { PostApiTaskCleanupRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskCleanupRequestBody = {
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `all`                     | *boolean*                 | :heavy_minus_sign:        | Cleanup all worktrees     |
| `branch`                  | *string*                  | :heavy_minus_sign:        | Branch name to cleanup    |
| `keepBranch`              | *boolean*                 | :heavy_minus_sign:        | Keep the git branch       |
| `list`                    | *boolean*                 | :heavy_minus_sign:        | List all worktrees        |
| `merged`                  | *boolean*                 | :heavy_minus_sign:        | Cleanup merged worktrees  |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |