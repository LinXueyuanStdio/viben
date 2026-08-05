# PageCreateUpdateConfigRequestBody

## Example Usage

```typescript
import { PageCreateUpdateConfigRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PageCreateUpdateConfigRequestBody = {
  workspacePath: "<value>",
  uid: "<id>",
};
```

## Fields

| Field                                                                                                 | Type                                                                                                  | Required                                                                                              | Description                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `workspacePath`                                                                                       | *string*                                                                                              | :heavy_check_mark:                                                                                    | Workspace path (required)                                                                             |
| `uid`                                                                                                 | *string*                                                                                              | :heavy_check_mark:                                                                                    | Page uid (required)                                                                                   |
| `name`                                                                                                | *string*                                                                                              | :heavy_minus_sign:                                                                                    | New page name                                                                                         |
| `description`                                                                                         | *string*                                                                                              | :heavy_minus_sign:                                                                                    | New page description (null to remove)                                                                 |
| `icon`                                                                                                | [operations.PageCreateUpdateConfigIcon](../../../sdk/models/operations/pagecreateupdateconfigicon.md) | :heavy_minus_sign:                                                                                    | New page icon (null to remove)                                                                        |
| `cover`                                                                                               | *string*                                                                                              | :heavy_minus_sign:                                                                                    | Cover image URL (null to remove)                                                                      |
| `pageWidth`                                                                                           | [operations.PageWidth](../../../sdk/models/operations/pagewidth.md)                                   | :heavy_minus_sign:                                                                                    | Page width (null to reset)                                                                            |
| `showToc`                                                                                             | *boolean*                                                                                             | :heavy_minus_sign:                                                                                    | Show table of contents sidebar (null to reset)                                                        |