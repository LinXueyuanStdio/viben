# TaskCreateEventRequestBody

## Example Usage

```typescript
import { TaskCreateEventRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateEventRequestBody = {
  workspacePath: "<value>",
  taskDir: "<value>",
};
```

## Fields

| Field                                 | Type                                  | Required                              | Description                           |
| ------------------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------------- |
| `workspacePath`                       | *string*                              | :heavy_check_mark:                    | Workspace path (required)             |
| `taskDir`                             | *string*                              | :heavy_check_mark:                    | Task directory path or ID (required)  |
| `since`                               | *number*                              | :heavy_minus_sign:                    | Get events after this sequence number |