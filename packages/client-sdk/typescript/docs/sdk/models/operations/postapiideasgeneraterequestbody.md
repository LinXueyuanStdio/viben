# PostApiIdeasGenerateRequestBody

## Example Usage

```typescript
import { PostApiIdeasGenerateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiIdeasGenerateRequestBody = {
  types: [
    "<value 1>",
    "<value 2>",
    "<value 3>",
  ],
  workspacePath: "<value>",
};
```

## Fields

| Field                      | Type                       | Required                   | Description                |
| -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| `append`                   | *boolean*                  | :heavy_minus_sign:         | Append to existing ideas   |
| `maxIdeas`                 | *number*                   | :heavy_minus_sign:         | Maximum ideas per type     |
| `model`                    | *string*                   | :heavy_minus_sign:         | AI model to use            |
| `output`                   | *string*                   | :heavy_minus_sign:         | Output directory           |
| `override`                 | *boolean*                  | :heavy_minus_sign:         | Force regenerate all types |
| `types`                    | *string*[]                 | :heavy_check_mark:         | Idea types to generate     |
| `workspacePath`            | *string*                   | :heavy_check_mark:         | Workspace path (required)  |