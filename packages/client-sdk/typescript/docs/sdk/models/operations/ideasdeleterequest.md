# IdeasDeleteRequest

## Example Usage

```typescript
import { IdeasDeleteRequest } from "@viben/client-sdk/sdk/models/operations";

let value: IdeasDeleteRequest = {
  workspacePath: "<value>",
  id: "<id>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `id`                      | *string*                  | :heavy_check_mark:        | Idea ID                   |