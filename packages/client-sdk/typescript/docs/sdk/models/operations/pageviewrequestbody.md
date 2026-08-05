# PageViewRequestBody

## Example Usage

```typescript
import { PageViewRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PageViewRequestBody = {
  workspacePath: "<value>",
  uid: "<id>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `uid`                     | *string*                  | :heavy_check_mark:        | Page uid (required)       |