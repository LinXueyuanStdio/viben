# GetApiModelsRequest

## Example Usage

```typescript
import { GetApiModelsRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiModelsRequest = {};
```

## Fields

| Field                                                             | Type                                                              | Required                                                          | Description                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `category`                                                        | [operations.Category](../../../sdk/models/operations/category.md) | :heavy_minus_sign:                                                | Filter by model category                                          |
| `includeGlobal`                                                   | *string*                                                          | :heavy_minus_sign:                                                | Include global models (default: true)                             |
| `includeProviderPredefined`                                       | *string*                                                          | :heavy_minus_sign:                                                | Include provider predefined models                                |
| `provider`                                                        | *string*                                                          | :heavy_minus_sign:                                                | Filter by provider type or ID                                     |
| `providerId`                                                      | *string*                                                          | :heavy_minus_sign:                                                | Filter by provider ID                                             |
| `surface`                                                         | [operations.Surface](../../../sdk/models/operations/surface.md)   | :heavy_minus_sign:                                                | Filter by media surface                                           |
| `workspacePath`                                                   | *string*                                                          | :heavy_minus_sign:                                                | Workspace path for context                                        |