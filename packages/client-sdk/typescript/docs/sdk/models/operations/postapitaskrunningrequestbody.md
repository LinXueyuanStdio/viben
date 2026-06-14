# PostApiTaskRunningRequestBody

## Example Usage

```typescript
import { PostApiTaskRunningRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskRunningRequestBody = {
  taskDir: "<value>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                | Type                                 | Required                             | Description                          |
| ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ |
| `taskDir`                            | *string*                             | :heavy_check_mark:                   | Task directory path or ID (required) |
| `workspacePath`                      | *string*                             | :heavy_check_mark:                   | Workspace path (required)            |