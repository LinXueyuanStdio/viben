# RewardCreateTypeRequestBody

## Example Usage

```typescript
import { RewardCreateTypeRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: RewardCreateTypeRequestBody = {
  workspacePath: "<value>",
  name: "<value>",
  description: "willing consequently as absent into divert",
};
```

## Fields

| Field                              | Type                               | Required                           | Description                        |
| ---------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| `workspacePath`                    | *string*                           | :heavy_check_mark:                 | Workspace path (required)          |
| `name`                             | *string*                           | :heavy_check_mark:                 | Reward type name (required)        |
| `description`                      | *string*                           | :heavy_check_mark:                 | Reward type description (required) |
| `weightDefault`                    | *number*                           | :heavy_minus_sign:                 | Default weight (optional)          |
| `promptContent`                    | *string*                           | :heavy_minus_sign:                 | Prompt content (optional)          |