# Executors

## Example Usage

```typescript
import { Executors } from "@viben/client-sdk/sdk/models/operations";

let value: Executors = {};
```

## Fields

| Field                                                                     | Type                                                                      | Required                                                                  | Description                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `type`                                                                    | *string*                                                                  | :heavy_minus_sign:                                                        | Executor type (e.g., CLAUDE_CODE)                                         |
| `name`                                                                    | *string*                                                                  | :heavy_minus_sign:                                                        | N/A                                                                       |
| `description`                                                             | *string*                                                                  | :heavy_minus_sign:                                                        | N/A                                                                       |
| `docsUrl`                                                                 | *string*                                                                  | :heavy_minus_sign:                                                        | N/A                                                                       |
| `availability`                                                            | [operations.Availability](../../../sdk/models/operations/availability.md) | :heavy_minus_sign:                                                        | N/A                                                                       |
| `supportsMcp`                                                             | *boolean*                                                                 | :heavy_minus_sign:                                                        | N/A                                                                       |
| `capabilities`                                                            | *string*[]                                                                | :heavy_minus_sign:                                                        | N/A                                                                       |
| `hasWorkspaceConfig`                                                      | *boolean*                                                                 | :heavy_minus_sign:                                                        | N/A                                                                       |
| `workspacePath`                                                           | *string*                                                                  | :heavy_minus_sign:                                                        | N/A                                                                       |