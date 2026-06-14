# GetApiSkillListRequest

## Example Usage

```typescript
import { GetApiSkillListRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiSkillListRequest = {};
```

## Fields

| Field                                                                                                           | Type                                                                                                            | Required                                                                                                        | Description                                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `agentId`                                                                                                       | *string*                                                                                                        | :heavy_minus_sign:                                                                                              | Agent ID (required when target is 'agent')                                                                      |
| `customPath`                                                                                                    | *string*                                                                                                        | :heavy_minus_sign:                                                                                              | Custom path (required when target is 'custom')                                                                  |
| `target`                                                                                                        | [operations.GetApiSkillListQueryParamTarget](../../../sdk/models/operations/getapiskilllistqueryparamtarget.md) | :heavy_minus_sign:                                                                                              | Filter by installation target                                                                                   |