# IdeaTypesDeleteRequest

## Example Usage

```typescript
import { IdeaTypesDeleteRequest } from "@viben/client-sdk/sdk/models/operations";

let value: IdeaTypesDeleteRequest = {
  workspacePath: "<value>",
  name: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `name`                    | *string*                  | :heavy_check_mark:        | Type name                 |