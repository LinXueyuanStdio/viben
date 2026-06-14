# PostApiMcpDownloadRequestBody

## Example Usage

```typescript
import { PostApiMcpDownloadRequestBody } from "@viben/client-sdk/sdk/models/operations";

let value: PostApiMcpDownloadRequestBody = {
  name: "<value>",
  targetDir: "<value>",
};
```

## Fields

| Field               | Type                | Required            | Description         |
| ------------------- | ------------------- | ------------------- | ------------------- |
| `name`              | *string*            | :heavy_check_mark:  | Package name or ID  |
| `targetDir`         | *string*            | :heavy_check_mark:  | Target directory    |
| `version`           | *string*            | :heavy_minus_sign:  | Version to download |