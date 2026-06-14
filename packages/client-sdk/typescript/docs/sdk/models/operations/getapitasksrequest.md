# GetApiTasksRequest

## Example Usage

```typescript
import { GetApiTasksRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiTasksRequest = {
  workspacePath: "<value>",
};
```

## Fields

| Field                                  | Type                                   | Required                               | Description                            |
| -------------------------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------- |
| `isTemplate`                           | *string*                               | :heavy_minus_sign:                     | Filter by template status (true/false) |
| `workspacePath`                        | *string*                               | :heavy_check_mark:                     | Workspace path (required)              |