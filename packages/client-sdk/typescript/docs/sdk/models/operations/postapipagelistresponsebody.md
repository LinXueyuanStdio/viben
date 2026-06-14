# PostApiPageListResponseBody

Default Response

## Example Usage

```typescript
import { PostApiPageListResponseBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiPageListResponseBody = {};
```

## Fields

| Field                                                         | Type                                                          | Required                                                      | Description                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `count`                                                       | *number*                                                      | :heavy_minus_sign:                                            | N/A                                                           |
| `error`                                                       | *string*                                                      | :heavy_minus_sign:                                            | N/A                                                           |
| `index`                                                       | Record<string, *string*[]>                                    | :heavy_minus_sign:                                            | Page index mapping parent keys to child uids                  |
| `pages`                                                       | [operations.Pages](../../../sdk/models/operations/pages.md)[] | :heavy_minus_sign:                                            | N/A                                                           |
| `success`                                                     | *boolean*                                                     | :heavy_minus_sign:                                            | N/A                                                           |