# TaskListEventsStreamRequest

## Example Usage

```typescript
import { TaskListEventsStreamRequest } from "@viben/client-sdk/sdk/models/operations";

let value: TaskListEventsStreamRequest = {
  workspacePath: "<value>",
};
```

## Fields

| Field                                  | Type                                   | Required                               | Description                            |
| -------------------------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------- |
| `workspacePath`                        | *string*                               | :heavy_check_mark:                     | Workspace path (required)              |
| `taskIds`                              | *string*                               | :heavy_minus_sign:                     | Comma-separated task IDs for filtering |
| `lastSequence`                         | *string*                               | :heavy_minus_sign:                     | Last received sequence for replay      |