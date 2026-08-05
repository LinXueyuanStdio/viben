# McpDownloadRequestBody

## Example Usage

```typescript
import { McpDownloadRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: McpDownloadRequestBody = {
  name: "<value>",
  targetDir: "<value>",
};
```

## Fields

| Field               | Type                | Required            | Description         |
| ------------------- | ------------------- | ------------------- | ------------------- |
| `name`              | *string*            | :heavy_check_mark:  | Package name or ID  |
| `version`           | *string*            | :heavy_minus_sign:  | Version to download |
| `targetDir`         | *string*            | :heavy_check_mark:  | Target directory    |