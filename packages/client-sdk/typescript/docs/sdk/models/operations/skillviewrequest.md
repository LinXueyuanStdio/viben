# SkillViewRequest

## Example Usage

```typescript
import { SkillViewRequest } from "@viben/client-sdk/sdk/models/operations";

let value: SkillViewRequest = {
  name: "<value>",
};
```

## Fields

| Field                                                                                               | Type                                                                                                | Required                                                                                            | Description                                                                                         |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `target`                                                                                            | [operations.SkillViewQueryParamTarget](../../../sdk/models/operations/skillviewqueryparamtarget.md) | :heavy_minus_sign:                                                                                  | N/A                                                                                                 |
| `agentId`                                                                                           | *string*                                                                                            | :heavy_minus_sign:                                                                                  | N/A                                                                                                 |
| `customPath`                                                                                        | *string*                                                                                            | :heavy_minus_sign:                                                                                  | N/A                                                                                                 |
| `name`                                                                                              | *string*                                                                                            | :heavy_check_mark:                                                                                  | Skill name                                                                                          |