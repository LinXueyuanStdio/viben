# PutApiRewardTypesNameRequestBody

## Example Usage

```typescript
import { PutApiRewardTypesNameRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PutApiRewardTypesNameRequestBody = {
  workspacePath: "<value>",
};
```

## Fields

| Field                         | Type                          | Required                      | Description                   |
| ----------------------------- | ----------------------------- | ----------------------------- | ----------------------------- |
| `description`                 | *string*                      | :heavy_minus_sign:            | New description (optional)    |
| `promptContent`               | *string*                      | :heavy_minus_sign:            | New prompt content (optional) |
| `weightDefault`               | *number*                      | :heavy_minus_sign:            | New default weight (optional) |
| `workspacePath`               | *string*                      | :heavy_check_mark:            | Workspace path (required)     |