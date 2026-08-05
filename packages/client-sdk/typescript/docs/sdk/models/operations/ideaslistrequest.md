# IdeasListRequest

## Example Usage

```typescript
import { IdeasListRequest } from "@viben/client-sdk/sdk/models/operations";

let value: IdeasListRequest = {
  workspacePath: "<value>",
};
```

## Fields

| Field                                                         | Type                                                          | Required                                                      | Description                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `workspacePath`                                               | *string*                                                      | :heavy_check_mark:                                            | Workspace path (required)                                     |
| `type`                                                        | *string*                                                      | :heavy_minus_sign:                                            | Filter by idea type                                           |
| `effort`                                                      | [operations.Effort](../../../sdk/models/operations/effort.md) | :heavy_minus_sign:                                            | Filter by effort level                                        |
| `status`                                                      | [operations.Status](../../../sdk/models/operations/status.md) | :heavy_minus_sign:                                            | Filter by status                                              |