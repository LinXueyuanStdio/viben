# RewardComputeRequestBody

## Example Usage

```typescript
import { RewardComputeRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: RewardComputeRequestBody = {
  workspacePath: "<value>",
  task: "<value>",
};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `workspacePath`                            | *string*                                   | :heavy_check_mark:                         | Workspace path (required)                  |
| `task`                                     | *string*                                   | :heavy_check_mark:                         | Task name or directory (required)          |
| `platform`                                 | *string*                                   | :heavy_minus_sign:                         | Platform (claude, cursor, iflow, opencode) |
| `verbose`                                  | *boolean*                                  | :heavy_minus_sign:                         | Enable verbose output                      |