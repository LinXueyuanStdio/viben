# GetApiTaskListArchiveRequest

## Example Usage

```typescript
import { GetApiTaskListArchiveRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiTaskListArchiveRequest = {
  workspacePath: "<value>",
};
```

## Fields

| Field                            | Type                             | Required                         | Description                      |
| -------------------------------- | -------------------------------- | -------------------------------- | -------------------------------- |
| `month`                          | *string*                         | :heavy_minus_sign:               | Filter by month (YYYY-MM format) |
| `workspacePath`                  | *string*                         | :heavy_check_mark:               | Workspace path (required)        |