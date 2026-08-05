# PageReorderRequestBody

## Example Usage

```typescript
import { PageReorderRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PageReorderRequestBody = {
  workspacePath: "<value>",
  orderedUids: [],
};
```

## Fields

| Field                                 | Type                                  | Required                              | Description                           |
| ------------------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------------- |
| `workspacePath`                       | *string*                              | :heavy_check_mark:                    | Workspace path (required)             |
| `parentUid`                           | *string*                              | :heavy_minus_sign:                    | Parent page uid (null for root level) |
| `orderedUids`                         | *string*[]                            | :heavy_check_mark:                    | Ordered list of page uids             |