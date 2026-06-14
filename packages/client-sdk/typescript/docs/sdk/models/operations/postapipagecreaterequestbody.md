# PostApiPageCreateRequestBody

## Example Usage

```typescript
import { PostApiPageCreateRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiPageCreateRequestBody = {
  name: "<value>",
  type: "proxy",
  workspacePath: "<value>",
};
```

## Fields

| Field                                                     | Type                                                      | Required                                                  | Description                                               |
| --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `command`                                                 | *string*                                                  | :heavy_minus_sign:                                        | Start command for server pages                            |
| `description`                                             | *string*                                                  | :heavy_minus_sign:                                        | Page description                                          |
| `file`                                                    | *string*                                                  | :heavy_minus_sign:                                        | Entry file for static pages                               |
| `headers`                                                 | Record<string, *string*>                                  | :heavy_minus_sign:                                        | Headers for proxy pages                                   |
| `icon`                                                    | [operations.Icon](../../../sdk/models/operations/icon.md) | :heavy_minus_sign:                                        | Page icon data                                            |
| `name`                                                    | *string*                                                  | :heavy_check_mark:                                        | Page name (required)                                      |
| `parentUid`                                               | *string*                                                  | :heavy_minus_sign:                                        | Parent page uid for creating subpages                     |
| `port`                                                    | *number*                                                  | :heavy_minus_sign:                                        | Port for server pages                                     |
| `readyPattern`                                            | *string*                                                  | :heavy_minus_sign:                                        | Ready pattern for server pages                            |
| `slug`                                                    | *string*                                                  | :heavy_minus_sign:                                        | Page slug (optional, used to generate uid)                |
| `timeout`                                                 | *number*                                                  | :heavy_minus_sign:                                        | Timeout for server pages                                  |
| `type`                                                    | [operations.Type](../../../sdk/models/operations/type.md) | :heavy_check_mark:                                        | Page type (required)                                      |
| `url`                                                     | *string*                                                  | :heavy_minus_sign:                                        | URL for proxy pages                                       |
| `workspacePath`                                           | *string*                                                  | :heavy_check_mark:                                        | Workspace path (required)                                 |