# PageCreateDeleteRequestBody

## Example Usage

```typescript
import { PageCreateDeleteRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PageCreateDeleteRequestBody = {
  workspacePath: "<value>",
  uid: "<id>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `uid`                     | *string*                  | :heavy_check_mark:        | Page uid (required)       |