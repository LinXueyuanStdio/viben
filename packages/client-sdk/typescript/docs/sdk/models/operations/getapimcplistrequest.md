# GetApiMcpListRequest

## Example Usage

```typescript
import { GetApiMcpListRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiMcpListRequest = {};
```

## Fields

| Field                                                                                                       | Type                                                                                                        | Required                                                                                                    | Description                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `all`                                                                                                       | *string*                                                                                                    | :heavy_minus_sign:                                                                                          | Set to 'true' to list from all targets                                                                      |
| `target`                                                                                                    | [operations.GetApiMcpListQueryParamTarget](../../../sdk/models/operations/getapimcplistqueryparamtarget.md) | :heavy_minus_sign:                                                                                          | Filter by installation target                                                                               |