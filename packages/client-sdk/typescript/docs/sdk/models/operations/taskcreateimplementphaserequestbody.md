# TaskCreateImplementPhaseRequestBody

## Example Usage

```typescript
import { TaskCreateImplementPhaseRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateImplementPhaseRequestBody = {
  workspacePath: "<value>",
  taskId: "<id>",
};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `workspacePath`                            | *string*                                   | :heavy_check_mark:                         | Workspace path (required)                  |
| `taskId`                                   | *string*                                   | :heavy_check_mark:                         | Task ID or directory (required)            |
| `platform`                                 | *string*                                   | :heavy_minus_sign:                         | Platform (claude, cursor, iflow, opencode) |
| `verbose`                                  | *boolean*                                  | :heavy_minus_sign:                         | Enable verbose output                      |