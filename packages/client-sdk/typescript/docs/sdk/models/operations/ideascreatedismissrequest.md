# IdeasCreateDismissRequest

## Example Usage

```typescript
import { IdeasCreateDismissRequest } from "@viben/client-sdk/sdk/models/operations";

let value: IdeasCreateDismissRequest = {
  id: "<id>",
  requestBody: {
    workspacePath: "<value>",
  },
};
```

## Fields

| Field                                                                                                       | Type                                                                                                        | Required                                                                                                    | Description                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`                                                                                                        | *string*                                                                                                    | :heavy_check_mark:                                                                                          | Idea ID                                                                                                     |
| `requestBody`                                                                                               | [operations.IdeasCreateDismissRequestBody](../../../sdk/models/operations/ideascreatedismissrequestbody.md) | :heavy_check_mark:                                                                                          | N/A                                                                                                         |