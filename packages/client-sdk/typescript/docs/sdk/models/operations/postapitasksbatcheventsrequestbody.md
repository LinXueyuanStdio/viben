# PostApiTasksBatchEventsRequestBody

## Example Usage

```typescript
import { PostApiTasksBatchEventsRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTasksBatchEventsRequestBody = {
  eventType: "<value>",
  taskDirs: [
    "<value 1>",
  ],
  workspacePath: "<value>",
};
```

## Fields

| Field                                                           | Type                                                            | Required                                                        | Description                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `eventType`                                                     | *string*                                                        | :heavy_check_mark:                                              | Event type to apply                                             |
| `payload`                                                       | [operations.Payload](../../../sdk/models/operations/payload.md) | :heavy_minus_sign:                                              | Optional event payload                                          |
| `taskDirs`                                                      | *string*[]                                                      | :heavy_check_mark:                                              | Task directories or IDs to apply event to                       |
| `workspacePath`                                                 | *string*                                                        | :heavy_check_mark:                                              | Workspace path (required)                                       |