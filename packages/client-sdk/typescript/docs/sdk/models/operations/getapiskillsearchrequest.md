# GetApiSkillSearchRequest

## Example Usage

```typescript
import { GetApiSkillSearchRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiSkillSearchRequest = {
  query: "<value>",
};
```

## Fields

| Field                                                                         | Type                                                                          | Required                                                                      | Description                                                                   |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `limit`                                                                       | *string*                                                                      | :heavy_minus_sign:                                                            | Maximum results                                                               |
| `page`                                                                        | *string*                                                                      | :heavy_minus_sign:                                                            | Page number                                                                   |
| `query`                                                                       | *string*                                                                      | :heavy_check_mark:                                                            | Search query (required)                                                       |
| `type`                                                                        | [operations.QueryParamType](../../../sdk/models/operations/queryparamtype.md) | :heavy_minus_sign:                                                            | Filter by skill type                                                          |