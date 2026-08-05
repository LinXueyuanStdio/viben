# SkillSearchResponseBody

Default Response

## Example Usage

```typescript
import { SkillSearchResponseBody } from "@viben/client-sdk/sdk/models/operations";

let value: SkillSearchResponseBody = {};
```

## Fields

| Field                                                                                 | Type                                                                                  | Required                                                                              | Description                                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `success`                                                                             | *boolean*                                                                             | :heavy_minus_sign:                                                                    | N/A                                                                                   |
| `data`                                                                                | Record<string, *any*>[]                                                               | :heavy_minus_sign:                                                                    | N/A                                                                                   |
| `pagination`                                                                          | Record<string, *any*>                                                                 | :heavy_minus_sign:                                                                    | N/A                                                                                   |
| `skills`                                                                              | [operations.SkillSearchSkills](../../../sdk/models/operations/skillsearchskills.md)[] | :heavy_minus_sign:                                                                    | N/A                                                                                   |
| `total`                                                                               | *number*                                                                              | :heavy_minus_sign:                                                                    | N/A                                                                                   |
| `page`                                                                                | *number*                                                                              | :heavy_minus_sign:                                                                    | N/A                                                                                   |
| `totalPages`                                                                          | *number*                                                                              | :heavy_minus_sign:                                                                    | N/A                                                                                   |