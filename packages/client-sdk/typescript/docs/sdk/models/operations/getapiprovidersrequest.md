# GetApiProvidersRequest

## Example Usage

```typescript
import { GetApiProvidersRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiProvidersRequest = {};
```

## Fields

| Field                                                                                 | Type                                                                                  | Required                                                                              | Description                                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `category`                                                                            | [operations.QueryParamCategory](../../../sdk/models/operations/queryparamcategory.md) | :heavy_minus_sign:                                                                    | Filter by provider category                                                           |
| `surface`                                                                             | [operations.QueryParamSurface](../../../sdk/models/operations/queryparamsurface.md)   | :heavy_minus_sign:                                                                    | Filter by supported surface                                                           |