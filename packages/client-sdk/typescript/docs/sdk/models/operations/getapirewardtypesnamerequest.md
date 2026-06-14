# GetApiRewardTypesNameRequest

## Example Usage

```typescript
import { GetApiRewardTypesNameRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiRewardTypesNameRequest = {
  name: "<value>",
  workspacePath: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `name`                    | *string*                  | :heavy_check_mark:        | Reward type name          |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |