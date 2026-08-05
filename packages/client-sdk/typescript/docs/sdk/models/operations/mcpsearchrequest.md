# McpSearchRequest

## Example Usage

```typescript
import { McpSearchRequest } from "@viben/client-sdk/sdk/models/operations";

let value: McpSearchRequest = {
  query: "<value>",
};
```

## Fields

| Field                   | Type                    | Required                | Description             |
| ----------------------- | ----------------------- | ----------------------- | ----------------------- |
| `query`                 | *string*                | :heavy_check_mark:      | Search query (required) |
| `limit`                 | *string*                | :heavy_minus_sign:      | Maximum results         |
| `page`                  | *string*                | :heavy_minus_sign:      | Page number             |