# PostApiTaskStatusRequestBody

## Example Usage

```typescript
import { PostApiTaskStatusRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskStatusRequestBody = {};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `assignee`                | *string*                  | :heavy_minus_sign:        | Filter by assignee        |
| `detail`                  | *boolean*                 | :heavy_minus_sign:        | Show detailed status      |
| `list`                    | *boolean*                 | :heavy_minus_sign:        | List worktrees and agents |
| `registry`                | *boolean*                 | :heavy_minus_sign:        | Show agent registry       |
| `running`                 | *boolean*                 | :heavy_minus_sign:        | Show only running tasks   |
| `status`                  | *string*                  | :heavy_minus_sign:        | Filter by status          |