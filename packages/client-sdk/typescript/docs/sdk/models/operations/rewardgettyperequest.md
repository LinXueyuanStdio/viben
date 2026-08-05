# RewardGetTypeRequest

## Example Usage

```typescript
import { RewardGetTypeRequest } from "@viben/client-sdk/sdk/models/operations";

let value: RewardGetTypeRequest = {
  workspacePath: "<value>",
  name: "<value>",
};
```

## Fields

| Field                     | Type                      | Required                  | Description               |
| ------------------------- | ------------------------- | ------------------------- | ------------------------- |
| `workspacePath`           | *string*                  | :heavy_check_mark:        | Workspace path (required) |
| `name`                    | *string*                  | :heavy_check_mark:        | Reward type name          |