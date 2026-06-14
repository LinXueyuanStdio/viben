# PostApiPageUpdateContentRequestBody

## Example Usage

```typescript
import { PostApiPageUpdateContentRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiPageUpdateContentRequestBody = {
  content: "<value>",
  uid: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `content`                       | *string*                        | :heavy_check_mark:              | New markdown content (required) |
| `uid`                           | *string*                        | :heavy_check_mark:              | Page uid (required)             |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |