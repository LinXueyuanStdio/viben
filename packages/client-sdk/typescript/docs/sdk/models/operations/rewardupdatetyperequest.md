# RewardUpdateTypeRequest

## Example Usage

```typescript
import { RewardUpdateTypeRequest } from "@viben/client-sdk/sdk/models/operations";

let value: RewardUpdateTypeRequest = {
  name: "<value>",
  requestBody: {
    workspacePath: "<value>",
  },
};
```

## Fields

| Field                                                                                                   | Type                                                                                                    | Required                                                                                                | Description                                                                                             |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `name`                                                                                                  | *string*                                                                                                | :heavy_check_mark:                                                                                      | Reward type name                                                                                        |
| `requestBody`                                                                                           | [operations.RewardUpdateTypeRequestBody](../../../sdk/models/operations/rewardupdatetyperequestbody.md) | :heavy_check_mark:                                                                                      | N/A                                                                                                     |