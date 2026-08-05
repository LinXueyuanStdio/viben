# PageCreateApplyTemplateRequestBody

## Example Usage

```typescript
import { PageCreateApplyTemplateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PageCreateApplyTemplateRequestBody = {
  workspacePath: "<value>",
  uid: "<id>",
  templateId: "<id>",
};
```

## Fields

| Field                       | Type                        | Required                    | Description                 |
| --------------------------- | --------------------------- | --------------------------- | --------------------------- |
| `workspacePath`             | *string*                    | :heavy_check_mark:          | Workspace path (required)   |
| `uid`                       | *string*                    | :heavy_check_mark:          | Page uid (required)         |
| `templateId`                | *string*                    | :heavy_check_mark:          | Page template id (required) |