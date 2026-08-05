# SkillGetInfoRequest

## Example Usage

```typescript
import { SkillGetInfoRequest } from "@viben/client-sdk/sdk/models/operations";

let value: SkillGetInfoRequest = {
  idOrSlug: "<value>",
};
```

## Fields

| Field                                                                                                     | Type                                                                                                      | Required                                                                                                  | Description                                                                                               |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `format`                                                                                                  | [operations.SkillGetInfoQueryParamFormat](../../../sdk/models/operations/skillgetinfoqueryparamformat.md) | :heavy_minus_sign:                                                                                        | Response shape                                                                                            |
| `idOrSlug`                                                                                                | *string*                                                                                                  | :heavy_check_mark:                                                                                        | Skill ID or slug                                                                                          |