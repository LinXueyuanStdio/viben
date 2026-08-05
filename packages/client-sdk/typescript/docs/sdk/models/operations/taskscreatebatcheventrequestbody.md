# TasksCreateBatchEventRequestBody

## Example Usage

```typescript
import { TasksCreateBatchEventRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: TasksCreateBatchEventRequestBody = {
  workspacePath: "<value>",
  taskDirs: [],
  eventType: "<value>",
};
```

## Fields

| Field                                                           | Type                                                            | Required                                                        | Description                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `workspacePath`                                                 | *string*                                                        | :heavy_check_mark:                                              | Workspace path (required)                                       |
| `taskDirs`                                                      | *string*[]                                                      | :heavy_check_mark:                                              | Task directories or IDs to apply event to                       |
| `eventType`                                                     | *string*                                                        | :heavy_check_mark:                                              | Event type to apply                                             |
| `payload`                                                       | [operations.Payload](../../../sdk/models/operations/payload.md) | :heavy_minus_sign:                                              | Optional event payload                                          |