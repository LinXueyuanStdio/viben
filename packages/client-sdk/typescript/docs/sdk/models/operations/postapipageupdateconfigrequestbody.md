# PostApiPageUpdateConfigRequestBody

## Example Usage

```typescript
import { PostApiPageUpdateConfigRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiPageUpdateConfigRequestBody = {
  uid: "<id>",
  workspacePath: "<value>",
};
```

## Fields

| Field                                                                                                   | Type                                                                                                    | Required                                                                                                | Description                                                                                             |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `cover`                                                                                                 | *string*                                                                                                | :heavy_minus_sign:                                                                                      | Cover image URL (null to remove)                                                                        |
| `description`                                                                                           | *string*                                                                                                | :heavy_minus_sign:                                                                                      | New page description (null to remove)                                                                   |
| `icon`                                                                                                  | [operations.PostApiPageUpdateConfigIcon](../../../sdk/models/operations/postapipageupdateconfigicon.md) | :heavy_minus_sign:                                                                                      | New page icon (null to remove)                                                                          |
| `name`                                                                                                  | *string*                                                                                                | :heavy_minus_sign:                                                                                      | New page name                                                                                           |
| `pageWidth`                                                                                             | [operations.PageWidth](../../../sdk/models/operations/pagewidth.md)                                     | :heavy_minus_sign:                                                                                      | Page width (null to reset)                                                                              |
| `showToc`                                                                                               | *boolean*                                                                                               | :heavy_minus_sign:                                                                                      | Show table of contents sidebar (null to reset)                                                          |
| `uid`                                                                                                   | *string*                                                                                                | :heavy_check_mark:                                                                                      | Page uid (required)                                                                                     |
| `workspacePath`                                                                                         | *string*                                                                                                | :heavy_check_mark:                                                                                      | Workspace path (required)                                                                               |