# PutApiIdeaTypesNameRequestBody

## Example Usage

```typescript
import { PutApiIdeaTypesNameRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PutApiIdeaTypesNameRequestBody = {
  workspacePath: "<value>",
};
```

## Fields

| Field                      | Type                       | Required                   | Description                |
| -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| `description`              | *string*                   | :heavy_minus_sign:         | Human-readable description |
| `maxIdeas`                 | *number*                   | :heavy_minus_sign:         | Maximum ideas to generate  |
| `promptContent`            | *string*                   | :heavy_minus_sign:         | Prompt template content    |
| `workspacePath`            | *string*                   | :heavy_check_mark:         | Workspace path (required)  |