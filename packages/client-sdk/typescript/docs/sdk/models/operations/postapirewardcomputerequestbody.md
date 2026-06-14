# PostApiRewardComputeRequestBody

## Example Usage

```typescript
import { PostApiRewardComputeRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiRewardComputeRequestBody = {
  task: "<value>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `platform`                                 | *string*                                   | :heavy_minus_sign:                         | Platform (claude, cursor, iflow, opencode) |
| `task`                                     | *string*                                   | :heavy_check_mark:                         | Task name or directory (required)          |
| `verbose`                                  | *boolean*                                  | :heavy_minus_sign:                         | Enable verbose output                      |
| `workspacePath`                            | *string*                                   | :heavy_check_mark:                         | Workspace path (required)                  |