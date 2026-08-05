# ModelsListRequest

## Example Usage

```typescript
import { ModelsListRequest } from "@viben/client-sdk/sdk/models/operations";

let value: ModelsListRequest = {};
```

## Fields

| Field                                                             | Type                                                              | Required                                                          | Description                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `workspacePath`                                                   | *string*                                                          | :heavy_minus_sign:                                                | Workspace path for context                                        |
| `includeGlobal`                                                   | *string*                                                          | :heavy_minus_sign:                                                | Include global models (default: true)                             |
| `includeProviderPredefined`                                       | *string*                                                          | :heavy_minus_sign:                                                | Include provider predefined models                                |
| `providerId`                                                      | *string*                                                          | :heavy_minus_sign:                                                | Filter by provider ID                                             |
| `provider`                                                        | *string*                                                          | :heavy_minus_sign:                                                | Filter by provider type                                           |
| `category`                                                        | [operations.Category](../../../sdk/models/operations/category.md) | :heavy_minus_sign:                                                | Filter by model category                                          |
| `surface`                                                         | [operations.Surface](../../../sdk/models/operations/surface.md)   | :heavy_minus_sign:                                                | Filter by media surface                                           |