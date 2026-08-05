# SkillSearchClawhubRequest

## Example Usage

```typescript
import { SkillSearchClawhubRequest } from "@viben/client-sdk/sdk/models/operations";

let value: SkillSearchClawhubRequest = {
  query: "<value>",
};
```

## Fields

| Field                                           | Type                                            | Required                                        | Description                                     |
| ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `query`                                         | *string*                                        | :heavy_check_mark:                              | Search query                                    |
| `limit`                                         | *string*                                        | :heavy_minus_sign:                              | Maximum results                                 |
| `nonSuspiciousOnly`                             | *string*                                        | :heavy_minus_sign:                              | Whether to include only non-suspicious packages |