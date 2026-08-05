# TaskCreateQueueStatuResponseBody

Default Response

## Example Usage

```typescript
import { TaskCreateQueueStatuResponseBody } from "@viben/client-sdk/sdk/models/operations";

let value: TaskCreateQueueStatuResponseBody = {};
```

## Fields

| Field                                                                                                 | Type                                                                                                  | Required                                                                                              | Description                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pendingCount`                                                                                        | *number*                                                                                              | :heavy_minus_sign:                                                                                    | N/A                                                                                                   |
| `runningCount`                                                                                        | *number*                                                                                              | :heavy_minus_sign:                                                                                    | N/A                                                                                                   |
| `maxConcurrency`                                                                                      | *number*                                                                                              | :heavy_minus_sign:                                                                                    | N/A                                                                                                   |
| `tasks`                                                                                               | [operations.TaskCreateQueueStatuTasks](../../../sdk/models/operations/taskcreatequeuestatutasks.md)[] | :heavy_minus_sign:                                                                                    | N/A                                                                                                   |