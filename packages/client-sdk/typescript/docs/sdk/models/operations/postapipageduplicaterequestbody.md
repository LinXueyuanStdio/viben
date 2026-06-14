# PostApiPageDuplicateRequestBody

## Example Usage

```typescript
import { PostApiPageDuplicateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiPageDuplicateRequestBody = {
  uid: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                        | Type                         | Required                     | Description                  |
| ---------------------------- | ---------------------------- | ---------------------------- | ---------------------------- |
| `uid`                        | *string*                     | :heavy_check_mark:           | Source page uid to duplicate |
| `workspacePath`              | *string*                     | :heavy_check_mark:           | Workspace path (required)    |