# RewardUpdateTypeRequestBody

## Example Usage

```typescript
import { RewardUpdateTypeRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: RewardUpdateTypeRequestBody = {
  workspacePath: "<value>",
};
```

## Fields

| Field                         | Type                          | Required                      | Description                   |
| ----------------------------- | ----------------------------- | ----------------------------- | ----------------------------- |
| `workspacePath`               | *string*                      | :heavy_check_mark:            | Workspace path (required)     |
| `description`                 | *string*                      | :heavy_minus_sign:            | New description (optional)    |
| `weightDefault`               | *number*                      | :heavy_minus_sign:            | New default weight (optional) |
| `promptContent`               | *string*                      | :heavy_minus_sign:            | New prompt content (optional) |