# RewardSelectRequestBody

## Example Usage

```typescript
import { RewardSelectRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: RewardSelectRequestBody = {
  workspacePath: "<value>",
  tasks: [
    "<value 1>",
  ],
};
```

## Fields

| Field                                                  | Type                                                   | Required                                               | Description                                            |
| ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ |
| `workspacePath`                                        | *string*                                               | :heavy_check_mark:                                     | Workspace path (required)                              |
| `tasks`                                                | *string*[]                                             | :heavy_check_mark:                                     | Task names to compare (must have computed rewards)     |
| `threshold`                                            | *number*                                               | :heavy_minus_sign:                                     | Minimum adjusted reward threshold (default: 0.6)       |
| `klCoef`                                               | *number*                                               | :heavy_minus_sign:                                     | KL penalty coefficient (default: 0.05)                 |
| `maxDiff`                                              | *number*                                               | :heavy_minus_sign:                                     | Maximum diff lines for KL normalization (default: 500) |