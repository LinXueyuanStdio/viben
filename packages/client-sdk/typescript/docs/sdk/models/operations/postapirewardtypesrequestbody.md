# PostApiRewardTypesRequestBody

## Example Usage

```typescript
import { PostApiRewardTypesRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiRewardTypesRequestBody = {
  description: "if wholly whoever brr over",
  name: "<value>",
  workspacePath: "<value>",
};
```

## Fields

| Field                              | Type                               | Required                           | Description                        |
| ---------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| `description`                      | *string*                           | :heavy_check_mark:                 | Reward type description (required) |
| `name`                             | *string*                           | :heavy_check_mark:                 | Reward type name (required)        |
| `promptContent`                    | *string*                           | :heavy_minus_sign:                 | Prompt content (optional)          |
| `weightDefault`                    | *number*                           | :heavy_minus_sign:                 | Default weight (optional)          |
| `workspacePath`                    | *string*                           | :heavy_check_mark:                 | Workspace path (required)          |