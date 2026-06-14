# DeleteApiIdeasIdRequest

## Example Usage

```typescript
import { DeleteApiIdeasIdRequest } from "@viben/client-sdk/sdk/models/operations";

let value: DeleteApiIdeasIdRequest = {
  id: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `id`                      | *string*                  | :heavy_check_mark:        | Idea ID                   |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |