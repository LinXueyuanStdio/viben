# TaskCreateStatuRequestBody

## Example Usage

```typescript
import { TaskCreateStatuRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateStatuRequestBody = {};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `assignee`                | *string*                  | :heavy_minus_sign:        | Filter by assignee        |
| `status`                  | *string*                  | :heavy_minus_sign:        | Filter by status          |
| `running`                 | *boolean*                 | :heavy_minus_sign:        | Show only running tasks   |
| `registry`                | *boolean*                 | :heavy_minus_sign:        | Show agent registry       |
| `list`                    | *boolean*                 | :heavy_minus_sign:        | List worktrees and agents |
| `detail`                  | *boolean*                 | :heavy_minus_sign:        | Show detailed status      |