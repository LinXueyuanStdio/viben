# IdeaTypesUpdateRequestBody

## Example Usage

```typescript
import { IdeaTypesUpdateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: IdeaTypesUpdateRequestBody = {
  workspacePath: "<value>",
};
```

## Fields

| Field                      | Type                       | Required                   | Description                |
| -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| `workspacePath`            | *string*                   | :heavy_check_mark:         | Workspace path (required)  |
| `description`              | *string*                   | :heavy_minus_sign:         | Human-readable description |
| `maxIdeas`                 | *number*                   | :heavy_minus_sign:         | Maximum ideas to generate  |
| `promptContent`            | *string*                   | :heavy_minus_sign:         | Prompt template content    |