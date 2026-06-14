# PostApiTaskSpecsRequestBody

## Example Usage

```typescript
import { PostApiTaskSpecsRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskSpecsRequestBody = {
  taskDir: "<value>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                | Type                                 | Required                             | Description                          |
| ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| `taskDir`                            | *string*                             | :heavy_check_mark:                   | Task directory path or ID (required) |
| `workspacePath`                      | *string*                             | :heavy_check_mark:                   | Workspace path (required)            |