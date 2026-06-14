# PostApiPageReorderRequestBody

## Example Usage

```typescript
import { PostApiPageReorderRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiPageReorderRequestBody = {
  orderedUids: [
    "<value 1>",
    "<value 2>",
  ],
  workspacePath: "<value>",
};
```

## Fields

| Field                                 | Type                                  | Required                              | Description                           |
| ------------------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------------- |
| `orderedUids`                         | *string*[]                            | :heavy_check_mark:                    | Ordered list of page uids             |
| `parentUid`                           | *string*                              | :heavy_minus_sign:                    | Parent page uid (null for root level) |
| `workspacePath`                       | *string*                              | :heavy_check_mark:                    | Workspace path (required)             |