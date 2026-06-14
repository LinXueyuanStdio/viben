# DeleteApiIdeasRequest

## Example Usage

```typescript
import { DeleteApiIdeasRequest } from "@viben/client-sdk/sdk/models/operations";

let value: DeleteApiIdeasRequest = {
  workspacePath: "<value>",
};
```

## Fields

| Field                             | Type                              | Required                          | Description                       |
| --------------------------------- | --------------------------------- | --------------------------------- | --------------------------------- |
| `all`                             | *string*                          | :heavy_minus_sign:                | Set to 'true' to remove all ideas |
| `type`                            | *string*                          | :heavy_minus_sign:                | Remove all ideas of this type     |
| `workspacePath`                   | *string*                          | :heavy_check_mark:                | Workspace path (required)         |