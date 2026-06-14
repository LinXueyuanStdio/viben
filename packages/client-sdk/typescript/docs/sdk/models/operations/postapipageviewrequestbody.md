# PostApiPageViewRequestBody

## Example Usage

```typescript
import { PostApiPageViewRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiPageViewRequestBody = {
  uid: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `uid`                     | *string*                  | :heavy_check_mark:        | Page uid (required)       |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |