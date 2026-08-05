# IdeasGenerateRequestBody

## Example Usage

```typescript
import { IdeasGenerateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: IdeasGenerateRequestBody = {
  workspacePath: "<value>",
  types: [],
};
```

## Fields

| Field                      | Type                       | Required                   | Description                |
| -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| `workspacePath`            | *string*                   | :heavy_check_mark:         | Workspace path (required)  |
| `types`                    | *string*[]                 | :heavy_check_mark:         | Idea types to generate     |
| `output`                   | *string*                   | :heavy_minus_sign:         | Output directory           |
| `model`                    | *string*                   | :heavy_minus_sign:         | AI model to use            |
| `maxIdeas`                 | *number*                   | :heavy_minus_sign:         | Maximum ideas per type     |
| `append`                   | *boolean*                  | :heavy_minus_sign:         | Append to existing ideas   |
| `override`                 | *boolean*                  | :heavy_minus_sign:         | Force regenerate all types |