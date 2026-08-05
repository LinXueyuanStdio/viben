# McpListRequest

## Example Usage

```typescript
import { McpListRequest } from "@viben/client-sdk/sdk/models/operations";

let value: McpListRequest = {};
```

## Fields

| Field                                                                                           | Type                                                                                            | Required                                                                                        | Description                                                                                     |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `target`                                                                                        | [operations.McpListQueryParamTarget](../../../sdk/models/operations/mcplistqueryparamtarget.md) | :heavy_minus_sign:                                                                              | Filter by installation target                                                                   |
| `all`                                                                                           | *string*                                                                                        | :heavy_minus_sign:                                                                              | Set to 'true' to list from all targets                                                          |