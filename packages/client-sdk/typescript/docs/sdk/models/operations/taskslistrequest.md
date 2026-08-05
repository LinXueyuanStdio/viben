# TasksListRequest

## Example Usage

```typescript
import { TasksListRequest } from "@viben/client-sdk/sdk/models/operations";

let value: TasksListRequest = {
  workspacePath: "<value>",
};
```

## Fields

| Field                                  | Type                                   | Required                               | Description                            |
| -------------------------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------- |
| `workspacePath`                        | *string*                               | :heavy_check_mark:                     | Workspace path (required)              |
| `isTemplate`                           | *string*                               | :heavy_minus_sign:                     | Filter by template status (true/false) |