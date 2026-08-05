# PageServeRequestBody

## Example Usage

```typescript
import { PageServeRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PageServeRequestBody = {
  workspacePath: "<value>",
  uid: "<id>",
};
```

## Fields

| Field                                | Type                                 | Required                             | Description                          |
| ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| `workspacePath`                      | *string*                             | :heavy_check_mark:                   | Workspace path (required)            |
| `uid`                                | *string*                             | :heavy_check_mark:                   | Page uid (required)                  |
| `path`                               | *string*                             | :heavy_minus_sign:                   | File path within the page (optional) |