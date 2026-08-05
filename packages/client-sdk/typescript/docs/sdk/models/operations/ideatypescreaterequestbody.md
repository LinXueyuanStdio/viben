# IdeaTypesCreateRequestBody

## Example Usage

```typescript
import { IdeaTypesCreateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: IdeaTypesCreateRequestBody = {
  workspacePath: "<value>",
  name: "<value>",
  description: "jovially knowingly scarily incidentally profuse since postbox",
  promptContent: "<value>",
};
```

## Fields

| Field                      | Type                       | Required                   | Description                |
| -------------------------- | -------------------------- | -------------------------- | -------------------------- |
| `workspacePath`            | *string*                   | :heavy_check_mark:         | Workspace path (required)  |
| `name`                     | *string*                   | :heavy_check_mark:         | Type name (snake_case)     |
| `description`              | *string*                   | :heavy_check_mark:         | Human-readable description |
| `maxIdeas`                 | *number*                   | :heavy_minus_sign:         | Maximum ideas to generate  |
| `promptContent`            | *string*                   | :heavy_check_mark:         | Prompt template content    |