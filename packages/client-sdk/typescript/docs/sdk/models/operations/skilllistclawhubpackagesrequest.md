# SkillListClawhubPackagesRequest

## Example Usage

```typescript
import { SkillListClawhubPackagesRequest } from "@viben/client-sdk/sdk/models/operations";

let value: SkillListClawhubPackagesRequest = {};
```

## Fields

| Field                                                                         | Type                                                                          | Required                                                                      | Description                                                                   |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `limit`                                                                       | *string*                                                                      | :heavy_minus_sign:                                                            | Maximum results                                                               |
| `cursor`                                                                      | *string*                                                                      | :heavy_minus_sign:                                                            | Pagination cursor                                                             |
| `sort`                                                                        | [operations.QueryParamSort](../../../sdk/models/operations/queryparamsort.md) | :heavy_minus_sign:                                                            | Sort order                                                                    |