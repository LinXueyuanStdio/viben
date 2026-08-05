# PageListResponseBody

Default Response

## Example Usage

```typescript
import { PageListResponseBody } from "@viben/client-sdk/sdk/models/operations";

let value: PageListResponseBody = {};
```

## Fields

| Field                                                         | Type                                                          | Required                                                      | Description                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `success`                                                     | *boolean*                                                     | :heavy_minus_sign:                                            | N/A                                                           |
| `pages`                                                       | [operations.Pages](../../../sdk/models/operations/pages.md)[] | :heavy_minus_sign:                                            | N/A                                                           |
| `index`                                                       | Record<string, *string*[]>                                    | :heavy_minus_sign:                                            | Page index mapping parent keys to child uids                  |
| `count`                                                       | *number*                                                      | :heavy_minus_sign:                                            | N/A                                                           |
| `error`                                                       | *string*                                                      | :heavy_minus_sign:                                            | N/A                                                           |