# RewardDeleteTypeRequest

## Example Usage

```typescript
import { RewardDeleteTypeRequest } from "@viben/client-sdk/sdk/models/operations";

let value: RewardDeleteTypeRequest = {
  workspacePath: "<value>",
  name: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `name`                    | *string*                  | :heavy_check_mark:        | Reward type name          |