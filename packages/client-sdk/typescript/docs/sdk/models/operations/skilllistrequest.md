# SkillListRequest

## Example Usage

```typescript
import { SkillListRequest } from "@viben/client-sdk/sdk/models/operations";

let value: SkillListRequest = {};
```

## Fields

| Field                                                                                               | Type                                                                                                | Required                                                                                            | Description                                                                                         |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `target`                                                                                            | [operations.SkillListQueryParamTarget](../../../sdk/models/operations/skilllistqueryparamtarget.md) | :heavy_minus_sign:                                                                                  | Filter by installation target                                                                       |
| `agentId`                                                                                           | *string*                                                                                            | :heavy_minus_sign:                                                                                  | Agent ID (required when target is 'agent')                                                          |
| `customPath`                                                                                        | *string*                                                                                            | :heavy_minus_sign:                                                                                  | Custom path (required when target is 'custom')                                                      |