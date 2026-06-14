# PostApiTaskQueueStatusResponseBody

Default Response

## Example Usage

```typescript
import { PostApiTaskQueueStatusResponseBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiTaskQueueStatusResponseBody = {};
```

## Fields

| Field                                                                                                     | Type                                                                                                      | Required                                                                                                  | Description                                                                                               |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `maxConcurrency`                                                                                          | *number*                                                                                                  | :heavy_minus_sign:                                                                                        | N/A                                                                                                       |
| `pendingCount`                                                                                            | *number*                                                                                                  | :heavy_minus_sign:                                                                                        | N/A                                                                                                       |
| `runningCount`                                                                                            | *number*                                                                                                  | :heavy_minus_sign:                                                                                        | N/A                                                                                                       |
| `tasks`                                                                                                   | [operations.PostApiTaskQueueStatusTasks](../../../sdk/models/operations/postapitaskqueuestatustasks.md)[] | :heavy_minus_sign:                                                                                        | N/A                                                                                                       |