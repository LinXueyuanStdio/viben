# TaskListListArchiveRequest

## Example Usage

```typescript
import { TaskListListArchiveRequest } from "@viben/client-sdk/sdk/models/operations";

let value: TaskListListArchiveRequest = {
  workspacePath: "<value>",
};
```

## Fields

| Field                            | Type                             | Required                         | Description                      |
| -------------------------------- | -------------------------------- | -------------------------------- | -------------------------------- |
| `workspacePath`                  | *string*                         | :heavy_check_mark:               | Workspace path (required)        |
| `month`                          | *string*                         | :heavy_minus_sign:               | Filter by month (YYYY-MM format) |