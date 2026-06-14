# PostApiIdeaTypesRequestBody

## Example Usage

```typescript
import { PostApiIdeaTypesRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiIdeaTypesRequestBody = {
  description:
    "exalt unethically gadzooks or ick mmm rebound ugh voluntarily summary",
  name: "<value>",
  promptContent: "<value>",
  workspacePath: "<value>",
};
```

## Fields

| Field                      | Type                       | Required                   | Description                |
| -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| `description`              | *string*                   | :heavy_check_mark:         | Human-readable description |
| `maxIdeas`                 | *number*                   | :heavy_minus_sign:         | Maximum ideas to generate  |
| `name`                     | *string*                   | :heavy_check_mark:         | Type name (snake_case)     |
| `promptContent`            | *string*                   | :heavy_check_mark:         | Prompt template content    |
| `workspacePath`            | *string*                   | :heavy_check_mark:         | Workspace path (required)  |