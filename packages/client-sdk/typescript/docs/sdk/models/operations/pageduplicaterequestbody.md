# PageDuplicateRequestBody

## Example Usage

```typescript
import { PageDuplicateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PageDuplicateRequestBody = {
  workspacePath: "<value>",
  uid: "<id>",
};
```

## Fields

| Field                        | Type                         | Required                     | Description                  |
| ---------------------------- | ---------------------------- | ---------------------------- | ---------------------------- |
| `workspacePath`              | *string*                     | :heavy_check_mark:           | Workspace path (required)    |
| `uid`                        | *string*                     | :heavy_check_mark:           | Source page uid to duplicate |