# GetApiMcpSearchRequest

## Example Usage

```typescript
import { GetApiMcpSearchRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiMcpSearchRequest = {
  query: "<value>",
};
```

## Fields

| Field                   | Type                    | Required                | Description             |
| ----------------------- | ----------------------- | ----------------------- | ----------------------- |
| `limit`                 | *string*                | :heavy_minus_sign:      | Maximum results         |
| `page`                  | *string*                | :heavy_minus_sign:      | Page number             |
| `query`                 | *string*                | :heavy_check_mark:      | Search query (required) |