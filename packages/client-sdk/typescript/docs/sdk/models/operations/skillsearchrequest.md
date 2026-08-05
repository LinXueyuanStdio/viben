# SkillSearchRequest

## Example Usage

```typescript
import { SkillSearchRequest } from "@viben/client-sdk/sdk/models/operations";

let value: SkillSearchRequest = {
  query: "<value>",
};
```

## Fields

| Field                                                                             | Type                                                                              | Required                                                                          | Description                                                                       |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `query`                                                                           | *string*                                                                          | :heavy_check_mark:                                                                | Search query (required)                                                           |
| `limit`                                                                           | *string*                                                                          | :heavy_minus_sign:                                                                | Maximum results                                                                   |
| `page`                                                                            | *string*                                                                          | :heavy_minus_sign:                                                                | Page number                                                                       |
| `type`                                                                            | [operations.QueryParamType](../../../sdk/models/operations/queryparamtype.md)     | :heavy_minus_sign:                                                                | Filter by skill type                                                              |
| `format`                                                                          | [operations.QueryParamFormat](../../../sdk/models/operations/queryparamformat.md) | :heavy_minus_sign:                                                                | Response shape                                                                    |