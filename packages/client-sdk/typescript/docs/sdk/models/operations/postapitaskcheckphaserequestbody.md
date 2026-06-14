# PostApiTaskCheckPhaseRequestBody

## Example Usage

```typescript
import { PostApiTaskCheckPhaseRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskCheckPhaseRequestBody = {
  taskId: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `platform`                                 | *string*                                   | :heavy_minus_sign:                         | Platform (claude, cursor, iflow, opencode) |
| `taskId`                                   | *string*                                   | :heavy_check_mark:                         | Task ID or directory (required)            |
| `verbose`                                  | *boolean*                                  | :heavy_minus_sign:                         | Enable verbose output                      |
| `workspacePath`                            | *string*                                   | :heavy_check_mark:                         | Workspace path (required)                  |