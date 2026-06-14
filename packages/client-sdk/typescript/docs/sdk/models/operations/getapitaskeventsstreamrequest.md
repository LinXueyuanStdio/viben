# GetApiTaskEventsStreamRequest

## Example Usage

```typescript
import { GetApiTaskEventsStreamRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiTaskEventsStreamRequest = {
  workspacePath: "<value>",
};
```

## Fields

| Field                                  | Type                                   | Required                               | Description                            |
| -------------------------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------- |
| `lastSequence`                         | *string*                               | :heavy_minus_sign:                     | Last received sequence for replay      |
| `taskIds`                              | *string*                               | :heavy_minus_sign:                     | Comma-separated task IDs for filtering |
| `workspacePath`                        | *string*                               | :heavy_check_mark:                     | Workspace path (required)              |