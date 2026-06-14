# GetApiPreviewStartSseRequest

## Example Usage

```typescript
import { GetApiPreviewStartSseRequest } from "@viben/client-sdk/sdk/models/operations";

let value: GetApiPreviewStartSseRequest = {
  taskId: "<id>",
  workDir: "<value>",
};
```

## Fields

| Field                                                 | Type                                                  | Required                                              | Description                                           |
| ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `command`                                             | *string*                                              | :heavy_minus_sign:                                    | Custom command to run (e.g., 'npm run serve')         |
| `port`                                                | *string*                                              | :heavy_minus_sign:                                    | Preferred port (optional)                             |
| `readyPattern`                                        | *string*                                              | :heavy_minus_sign:                                    | Regex pattern to detect server ready in stdout/stderr |
| `taskId`                                              | *string*                                              | :heavy_check_mark:                                    | Task identifier                                       |
| `timeout`                                             | *string*                                              | :heavy_minus_sign:                                    | Startup timeout in milliseconds                       |
| `workDir`                                             | *string*                                              | :heavy_check_mark:                                    | Working directory path                                |