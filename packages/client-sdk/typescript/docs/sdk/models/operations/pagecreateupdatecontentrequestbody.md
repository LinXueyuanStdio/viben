# PageCreateUpdateContentRequestBody

## Example Usage

```typescript
import { PageCreateUpdateContentRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PageCreateUpdateContentRequestBody = {
  workspacePath: "<value>",
  uid: "<id>",
  content: "<value>",
};
```

## Fields

| Field                           | Type                            | Required                        | Description                     |
| ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------- |
| `workspacePath`                 | *string*                        | :heavy_check_mark:              | Workspace path (required)       |
| `uid`                           | *string*                        | :heavy_check_mark:              | Page uid (required)             |
| `content`                       | *string*                        | :heavy_check_mark:              | New markdown content (required) |