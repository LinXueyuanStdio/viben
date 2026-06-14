# PostApiRewardSelectRequestBody

## Example Usage

```typescript
import { PostApiRewardSelectRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiRewardSelectRequestBody = {
  tasks: [
    "<value 1>",
    "<value 2>",
  ],
  workspacePath: "<value>",
};
```

## Fields

| Field                                                  | Type                                                   | Required                                               | Description                                            |
| ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ |
| `klCoef`                                               | *number*                                               | :heavy_minus_sign:                                     | KL penalty coefficient (default: 0.05)                 |
| `maxDiff`                                              | *number*                                               | :heavy_minus_sign:                                     | Maximum diff lines for KL normalization (default: 500) |
| `tasks`                                                | *string*[]                                             | :heavy_check_mark:                                     | Task names to compare (must have computed rewards)     |
| `threshold`                                            | *number*                                               | :heavy_minus_sign:                                     | Minimum adjusted reward threshold (default: 0.6)       |
| `workspacePath`                                        | *string*                                               | :heavy_check_mark:                                     | Workspace path (required)                              |