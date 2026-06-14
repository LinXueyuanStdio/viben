# PostApiPageServeRequestBody

## Example Usage

```typescript
import { PostApiPageServeRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiPageServeRequestBody = {
  uid: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                | Type                                 | Required                             | Description                          |
| ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| `path`                               | *string*                             | :heavy_minus_sign:                   | File path within the page (optional) |
| `uid`                                | *string*                             | :heavy_check_mark:                   | Page uid (required)                  |
| `workspacePath`                      | *string*                             | :heavy_check_mark:                   | Workspace path (required)            |