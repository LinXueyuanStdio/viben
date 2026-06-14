# PostApiTaskEventsRequestBody

## Example Usage

```typescript
import { PostApiTaskEventsRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskEventsRequestBody = {
  taskDir: "<value>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                 | Type                                  | Required                              | Description                           |
| ------------------------------------- | ------------------------------------- | ------------------------------------- | ------------------------------------- |
| `since`                               | *number*                              | :heavy_minus_sign:                    | Get events after this sequence number |
| `taskDir`                             | *string*                              | :heavy_check_mark:                    | Task directory path or ID (required)  |
| `workspacePath`                       | *string*                              | :heavy_check_mark:                    | Workspace path (required)             |