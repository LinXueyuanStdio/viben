# IdeasDelete2Request

## Example Usage

```typescript
import { IdeasDelete2Request } from "@viben/client-sdk/sdk/models/operations";

let value: IdeasDelete2Request = {
  workspacePath: "<value>",
};
```

## Fields

| Field                             | Type                              | Required                          | Description                       |
| --------------------------------- | --------------------------------- | --------------------------------- | --------------------------------- |
| `workspacePath`                   | *string*                          | :heavy_check_mark:                | Workspace path (required)         |
| `type`                            | *string*                          | :heavy_minus_sign:                | Remove all ideas of this type     |
| `all`                             | *string*                          | :heavy_minus_sign:                | Set to 'true' to remove all ideas |