# GetApiIdeasIdRequest

## Example Usage

```typescript
import { GetApiIdeasIdRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiIdeasIdRequest = {
  id: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `id`                      | *string*                  | :heavy_check_mark:        | Idea ID                   |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |