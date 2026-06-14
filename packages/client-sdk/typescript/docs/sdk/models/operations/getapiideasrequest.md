# GetApiIdeasRequest

## Example Usage

```typescript
import { GetApiIdeasRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiIdeasRequest = {
  workspacePath: "<value>",
};
```

## Fields

| Field                                                         | Type                                                          | Required                                                      | Description                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `effort`                                                      | [operations.Effort](../../../sdk/models/operations/effort.md) | :heavy_minus_sign:                                            | Filter by effort level                                        |
| `status`                                                      | [operations.Status](../../../sdk/models/operations/status.md) | :heavy_minus_sign:                                            | Filter by status                                              |
| `type`                                                        | *string*                                                      | :heavy_minus_sign:                                            | Filter by idea type                                           |
| `workspacePath`                                               | *string*                                                      | :heavy_check_mark:                                            | Workspace path (required)                                     |