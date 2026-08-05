# IdeasPromoteRequest

## Example Usage

```typescript
import { IdeasPromoteRequest } from "@viben/client-sdk/sdk/models/operations";

let value: IdeasPromoteRequest = {
  id: "<id>",
  requestBody: {
    workspacePath: "<value>",
  },
};
```

## Fields

| Field                                                                                           | Type                                                                                            | Required                                                                                        | Description                                                                                     |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `id`                                                                                            | *string*                                                                                        | :heavy_check_mark:                                                                              | Idea ID                                                                                         |
| `requestBody`                                                                                   | [operations.IdeasPromoteRequestBody](../../../sdk/models/operations/ideaspromoterequestbody.md) | :heavy_check_mark:                                                                              | N/A                                                                                             |